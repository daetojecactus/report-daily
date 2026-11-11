import { Injectable } from '@nestjs/common';
import { SourceActionKind, SourceRefType } from 'src/modules/application/source/types/source.enums';
import type {
  CleanEvent,
  GroupedIssue,
  GroupedMergeRequest,
} from 'src/modules/application/source/types/source.interface';
import {
  TaskFlag,
  TaskKind,
  TraitDimension,
  WorkflowState,
} from 'src/modules/application/trait/types/trait.enums';
import type { TaskTraits, TraitIndex } from 'src/modules/application/trait/types/trait.interface';
import { TraitService } from 'src/modules/application/trait/trait.service';
import {
  ACTIVITY_BEFORE_DAY,
  ACTIVITY_DEPENDENCY_BRANCH_PATTERN,
  ACTIVITY_CONVENTIONAL_DEPENDENCY_SCOPE,
  ACTIVITY_CONVENTIONAL_KINDS,
  ACTIVITY_CONVENTIONAL_PATTERN,
  ACTIVITY_PUSH_ACTIONS,
  ACTIVITY_WORK_ITEM_KINDS,
  ACTIVITY_RETURN_STATES,
} from './constants/activity.constants';
import { EngagementLevel } from './types/activity.enums';
import { ActivityEngagement } from './activity.engagement';
import type {
  ActivityChange,
  ActivityEmployee,
  ActivityFact,
  ActivityLine,
  ActivityLineSignals,
  ActivityPush,
} from './types/activity.interface';
import { ActivityRules } from './activity.rules';

@Injectable()
export class ActivitySignals {
  constructor(
    private readonly traitService: TraitService,
    private readonly activityEngagement: ActivityEngagement,
    private readonly activityRules: ActivityRules,
  ) {}

  build(line: ActivityLine, employee: ActivityEmployee, index: TraitIndex): ActivityLineSignals {
    const items = this.toItems(line);
    const facts = items
      .flatMap(({ item, mergeRequestIid }) =>
        item.facts.map((fact) => ({ ...fact, time: Date.parse(fact.at), mergeRequestIid })),
      )
      .sort((left, right) => left.time - right.time);
    const ownMergeRequests = line.mergeRequests
      .filter(
        (mergeRequest) =>
          mergeRequest.author === employee.username ||
          mergeRequest.assignees.includes(employee.username),
      )
      .map((mergeRequest) => mergeRequest.iid);
    const { own, dropped } = this.activityRules.clean(
      facts.filter((fact) => fact.own),
      employee,
      ownMergeRequests,
      (name) => this.traitService.isIgnored(index, name),
    );
    const pushes = this.toPushes(line);
    const endNames = items.flatMap(({ item }) => [...item.labels, ...this.toStatus(item)]);
    const startNames = items.flatMap(({ item }) => [
      ...item.startOfDay.labels,
      ...(item.startOfDay.status ? [item.startOfDay.status] : []),
    ]);
    const end = this.traitService.toTaskTraits(index, endNames);
    const start = this.traitService.toTaskTraits(index, startNames);
    const workItemKind = line.issue?.workItemType
      ? ACTIVITY_WORK_ITEM_KINDS.get(line.issue.workItemType)
      : undefined;
    const fallbackKind = workItemKind ?? this.toConventionalKind(line, pushes);
    const kinds = end.kinds.length || !fallbackKind ? end.kinds : [fallbackKind];
    const mainIid = line.issue ? null : (line.mergeRequests.at(0)?.iid ?? null);
    const others = facts.filter((fact) => !fact.own);
    const history = this.toHistory([...own, ...others], index);
    const changes = this.toChanges(own, index, history, start.workflowStates);
    const otherChanges = this.toChanges(others, index, history, start.workflowStates);
    const signals: ActivityLineSignals = {
      line,
      employee,
      own,
      dropped,
      others,
      changes,
      otherChanges,
      pushes,
      kind: kinds.at(0) ?? null,
      kinds,
      startStates: start.workflowStates,
      endStates: end.workflowStates,
      startFlags: start.flags,
      endFlags: end.flags,
      priority: end.priority,
      removedFlags: facts
        .filter((fact) => fact.kind === SourceActionKind.LABEL_REMOVED && fact.value)
        .flatMap((fact) =>
          this.traitService.findValues(index, fact.value ?? '', TraitDimension.FLAG),
        ),
      ownMergeRequests,
      assignee: items.some(({ item }) => item.assignees.includes(employee.username)),
      createdToday: own.some(
        (fact) => fact.kind === SourceActionKind.OPENED && fact.mergeRequestIid === mainIid,
      ),
      closedToday: line.issue?.closedOnReportDate ?? false,
      mergedToday: line.mergeRequests.some((mergeRequest) => mergeRequest.mergedOnReportDate),
      lastCommitAt: this.toLastCommitAt(line.mergeRequests),
      returnedAt: this.toReturnedAt(
        start,
        otherChanges,
        items.flatMap(({ item }) => item.assignees),
      ),
      dependencies:
        kinds.includes(TaskKind.DEPENDENCY) ||
        line.mergeRequests.some((mergeRequest) =>
          ACTIVITY_DEPENDENCY_BRANCH_PATTERN.test(mergeRequest.sourceBranch),
        ),
      dialog: this.hasDialog(own, others),
      engagement: EngagementLevel.OBSERVER,
    };
    signals.engagement = this.activityEngagement.resolve(signals);
    return signals;
  }

  private toItems(line: ActivityLine) {
    const items: { item: GroupedIssue | GroupedMergeRequest; mergeRequestIid: number | null }[] =
      line.mergeRequests.map((mergeRequest) => ({
        item: mergeRequest,
        mergeRequestIid: mergeRequest.iid,
      }));
    return line.issue ? [{ item: line.issue, mergeRequestIid: null }, ...items] : items;
  }

  private toStatus(item: GroupedIssue | GroupedMergeRequest) {
    return 'status' in item && item.status ? [item.status] : [];
  }

  private toHistory(facts: ActivityFact[], index: TraitIndex) {
    return facts
      .toSorted((left, right) => left.time - right.time)
      .flatMap((fact) => {
        const state = this.toState(fact, index);
        return state ? [{ time: fact.time, state }] : [];
      });
  }

  private toState(fact: ActivityFact, index: TraitIndex) {
    return (fact.kind === SourceActionKind.LABEL_ADDED ||
      fact.kind === SourceActionKind.STATUS_SET) &&
      fact.value
      ? (this.traitService.findValues(index, fact.value, TraitDimension.WORKFLOW_STATE).at(0) ??
          null)
      : null;
  }

  private toChanges(
    facts: ActivityFact[],
    index: TraitIndex,
    history: { time: number; state: WorkflowState }[],
    startStates: WorkflowState[],
  ): ActivityChange[] {
    return facts
      .filter(
        (fact) =>
          (fact.kind === SourceActionKind.LABEL_ADDED ||
            fact.kind === SourceActionKind.STATUS_SET) &&
          fact.value,
      )
      .map((fact) => {
        const name = fact.value ?? '';
        const state = this.toState(fact, index);
        const previous = history.filter((mark) => mark.time < fact.time).at(-1);
        return {
          fact,
          state,
          flags:
            fact.kind === SourceActionKind.LABEL_ADDED
              ? this.traitService.findValues(index, name, TraitDimension.FLAG)
              : [],
          priority:
            this.traitService.findValues(index, name, TraitDimension.PRIORITY).at(0) ?? null,
          returnedFrom:
            state === WorkflowState.IN_PROGRESS
              ? ((previous ? [previous.state] : startStates).find((before) =>
                  ACTIVITY_RETURN_STATES.has(before),
                ) ?? null)
              : null,
        };
      })
      .filter((change) => change.state || change.flags.length || change.priority);
  }

  private toPushes(line: ActivityLine): ActivityPush[] {
    const sources: { events: CleanEvent[]; mergeRequestIid: number | null }[] = [
      ...line.mergeRequests.map((mergeRequest) => ({
        events: mergeRequest.events,
        mergeRequestIid: mergeRequest.iid,
      })),
      ...line.pushes
        .filter((push) => push.refType === SourceRefType.BRANCH)
        .map((push) => ({ events: push.events, mergeRequestIid: null })),
    ];
    return sources.flatMap(({ events, mergeRequestIid }) =>
      events
        .filter((event) => ACTIVITY_PUSH_ACTIONS.has(event.actionName) && event.pushData)
        .map((event) => ({
          time: Date.parse(event.createdAt),
          mergeRequestIid,
          commitCount: event.pushData?.commitCount ?? 0,
          commitTitles: event.pushData?.commits.length
            ? event.pushData.commits.map((commit) => commit.title)
            : event.pushData?.commitTitle
              ? [event.pushData.commitTitle]
              : [],
        })),
    );
  }

  private toConventionalKind(line: ActivityLine, pushes: ActivityPush[]) {
    const fromTitles = line.mergeRequests
      .map((mergeRequest) => this.toKindOfTitle(mergeRequest.title))
      .find((kind) => kind !== null);
    if (fromTitles) {
      return fromTitles;
    }
    const counts = new Map<TaskKind, number>();
    for (const title of pushes.flatMap((push) => push.commitTitles)) {
      const kind = this.toKindOfTitle(title);
      if (kind) {
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
    }
    return (
      [...counts].reduce<[TaskKind, number] | null>(
        (best, entry) => (best === null || entry[1] > best[1] ? entry : best),
        null,
      )?.[0] ?? null
    );
  }

  private toKindOfTitle(title: string) {
    const match = ACTIVITY_CONVENTIONAL_PATTERN.exec(title);
    if (!match) {
      return null;
    }
    const [, type, scope] = match;
    if (scope && ACTIVITY_CONVENTIONAL_DEPENDENCY_SCOPE.test(scope)) {
      return TaskKind.DEPENDENCY;
    }
    return ACTIVITY_CONVENTIONAL_KINDS.get(type.toLowerCase()) ?? null;
  }

  private toLastCommitAt(mergeRequests: GroupedMergeRequest[]) {
    const times = mergeRequests
      .map((mergeRequest) => mergeRequest.lastCommitAt)
      .filter((time) => time !== null)
      .map((time) => Date.parse(time));
    return times.length ? Math.max(...times) : null;
  }

  private toReturnedAt(start: TaskTraits, otherChanges: ActivityChange[], assignees: string[]) {
    if (
      start.flags.includes(TaskFlag.RETURNED_FROM_QA) ||
      start.workflowStates.includes(WorkflowState.CHANGES_REQUESTED)
    ) {
      return ACTIVITY_BEFORE_DAY;
    }
    return (
      otherChanges.find(
        (change) =>
          change.flags.includes(TaskFlag.RETURNED_FROM_QA) ||
          change.state === WorkflowState.CHANGES_REQUESTED ||
          (change.returnedFrom !== null && !assignees.includes(change.fact.actor ?? '')),
      )?.fact.time ?? null
    );
  }

  private hasDialog(own: ActivityFact[], others: ActivityFact[]) {
    const onMergeRequests = (fact: ActivityFact) =>
      fact.kind === SourceActionKind.COMMENTED && fact.mergeRequestIid !== null;
    return own.some(onMergeRequests) && others.some(onMergeRequests);
  }
}
