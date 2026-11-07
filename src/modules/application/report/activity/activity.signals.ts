import { Injectable } from '@nestjs/common';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import type {
  GroupedIssue,
  GroupedMergeRequest,
} from 'src/modules/application/source/source.interface';
import {
  TaskFlag,
  TaskKind,
  TraitDimension,
  WorkflowState,
} from 'src/modules/application/trait/trait.enums';
import type { TraitIndex } from 'src/modules/application/trait/trait.interface';
import { TraitService } from 'src/modules/application/trait/trait.service';
import {
  ACTIVITY_BEFORE_DAY,
  ACTIVITY_DEPENDENCY_BRANCH_PATTERN,
  ACTIVITY_PUSH_ACTIONS,
} from './constants/activity.constants';
import { EngagementLevel } from './activity.enums';
import { ActivityEngagement } from './activity.engagement';
import type {
  ActivityChange,
  ActivityEmployee,
  ActivityFact,
  ActivityLine,
  ActivityLineSignals,
  ActivityPush,
} from './activity.interface';
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
    );
    const changes = this.toChanges(own, index);
    const pushes = this.toPushes(line.mergeRequests);
    const endNames = items.flatMap(({ item }) => [...item.labels, ...this.toStatus(item)]);
    const startNames = items.flatMap(({ item }) => [
      ...item.startOfDay.labels,
      ...(item.startOfDay.status ? [item.startOfDay.status] : []),
    ]);
    const end = this.traitService.toTaskTraits(index, endNames);
    const start = this.traitService.toTaskTraits(index, startNames);
    const mainIid = line.issue ? null : (line.mergeRequests.at(0)?.iid ?? null);
    const others = facts.filter((fact) => !fact.own);
    const signals: ActivityLineSignals = {
      line,
      employee,
      own,
      dropped,
      others,
      changes,
      pushes,
      kind: end.kinds.at(0) ?? null,
      kinds: end.kinds,
      startStates: start.workflowStates,
      endStates: end.workflowStates,
      startFlags: start.flags,
      endFlags: end.flags,
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
      returnedAt: this.toReturnedAt(start.flags, start.workflowStates, others, index),
      dependencies:
        end.kinds.includes(TaskKind.DEPENDENCY) ||
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

  private toChanges(own: ActivityFact[], index: TraitIndex): ActivityChange[] {
    return own
      .filter(
        (fact) =>
          (fact.kind === SourceActionKind.LABEL_ADDED ||
            fact.kind === SourceActionKind.STATUS_SET) &&
          fact.value,
      )
      .map((fact) => {
        const name = fact.value ?? '';
        return {
          fact,
          state:
            this.traitService.findValues(index, name, TraitDimension.WORKFLOW_STATE).at(0) ?? null,
          flags:
            fact.kind === SourceActionKind.LABEL_ADDED
              ? this.traitService.findValues(index, name, TraitDimension.FLAG)
              : [],
          priority:
            this.traitService.findValues(index, name, TraitDimension.PRIORITY).at(0) ?? null,
        };
      })
      .filter((change) => change.state || change.flags.length || change.priority);
  }

  private toPushes(mergeRequests: GroupedMergeRequest[]): ActivityPush[] {
    return mergeRequests.flatMap((mergeRequest) =>
      mergeRequest.events
        .filter((event) => ACTIVITY_PUSH_ACTIONS.has(event.actionName) && event.pushData)
        .map((event) => ({
          time: Date.parse(event.createdAt),
          mergeRequestIid: mergeRequest.iid,
          commitCount: event.pushData?.commitCount ?? 0,
          commitTitles: event.pushData?.commits.length
            ? event.pushData.commits.map((commit) => commit.title)
            : event.pushData?.commitTitle
              ? [event.pushData.commitTitle]
              : [],
        })),
    );
  }

  private toLastCommitAt(mergeRequests: GroupedMergeRequest[]) {
    const times = mergeRequests
      .map((mergeRequest) => mergeRequest.lastCommitAt)
      .filter((time) => time !== null)
      .map((time) => Date.parse(time));
    return times.length ? Math.max(...times) : null;
  }

  private toReturnedAt(
    startFlags: TaskFlag[],
    startStates: WorkflowState[],
    others: ActivityFact[],
    index: TraitIndex,
  ) {
    if (
      startFlags.includes(TaskFlag.RETURNED_FROM_QA) ||
      startStates.includes(WorkflowState.CHANGES_REQUESTED)
    ) {
      return ACTIVITY_BEFORE_DAY;
    }
    const isReturn = (name: string) =>
      this.traitService
        .findValues(index, name, TraitDimension.FLAG)
        .includes(TaskFlag.RETURNED_FROM_QA) ||
      this.traitService
        .findValues(index, name, TraitDimension.WORKFLOW_STATE)
        .includes(WorkflowState.CHANGES_REQUESTED);
    return (
      others.find(
        (fact) =>
          (fact.kind === SourceActionKind.LABEL_ADDED ||
            fact.kind === SourceActionKind.STATUS_SET) &&
          isReturn(fact.value ?? ''),
      )?.time ?? null
    );
  }

  private hasDialog(own: ActivityFact[], others: ActivityFact[]) {
    const onMergeRequests = (fact: ActivityFact) =>
      fact.kind === SourceActionKind.COMMENTED && fact.mergeRequestIid !== null;
    return own.some(onMergeRequests) && others.some(onMergeRequests);
  }
}
