import { Injectable } from '@nestjs/common';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import type {
  GroupedIssue,
  GroupedMergeRequest,
} from 'src/modules/application/source/source.interface';
import { TaskKind, TraitDimension } from 'src/modules/application/trait/trait.enums';
import type { TraitIndex } from 'src/modules/application/trait/trait.interface';
import { TraitService } from 'src/modules/application/trait/trait.service';
import {
  ACTIVITY_AUTO_STATUS_MS,
  ACTIVITY_DEPENDENCY_BRANCH_PATTERN,
  ACTIVITY_EDIT_FACTS,
  ACTIVITY_LIFECYCLE_FACTS,
  ACTIVITY_MERGE_CLOSE_MS,
  ACTIVITY_OPPOSITE_FACTS,
  ACTIVITY_PUSH_ACTIONS,
  ACTIVITY_SETUP_FACTS,
  ACTIVITY_SETUP_MS,
  ACTIVITY_SWAP_FACTS,
  ACTIVITY_SWAP_MS,
  ACTIVITY_UNDO_MS,
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

@Injectable()
export class ActivitySignals {
  constructor(
    private readonly traitService: TraitService,
    private readonly activityEngagement: ActivityEngagement,
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
    const own = this.cleanOwnFacts(
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

  private cleanOwnFacts(
    facts: ActivityFact[],
    employee: ActivityEmployee,
    ownMergeRequests: number[],
  ) {
    const undone = this.findUndone(facts);
    const active = facts.filter((fact) => !undone.has(fact));
    const creations = facts.filter((fact) => fact.kind === SourceActionKind.OPENED);
    const merges = facts.filter((fact) => fact.kind === SourceActionKind.MERGED);
    const kept = active.filter(
      (fact) =>
        !this.isSetup(fact, creations) &&
        !this.isAutomaticStatus(fact, facts) &&
        !this.isClosedByMerge(fact, merges) &&
        !this.isSelfApproval(fact, ownMergeRequests) &&
        !this.isSelfReviewRemoval(fact, employee) &&
        !this.isReplaced(fact, active),
    );
    return kept.filter((fact, index) => !this.isRepeated(fact, kept.slice(0, index)));
  }

  private findUndone(facts: ActivityFact[]) {
    const undone = new Set<ActivityFact>();
    for (const [index, fact] of facts.entries()) {
      const opposite = ACTIVITY_OPPOSITE_FACTS.get(fact.kind);
      if (!opposite || undone.has(fact)) {
        continue;
      }
      const reverse = facts
        .slice(index + 1)
        .find(
          (other) =>
            !undone.has(other) &&
            other.kind === opposite &&
            other.mergeRequestIid === fact.mergeRequestIid &&
            this.toUndoKey(other) === this.toUndoKey(fact) &&
            other.time - fact.time <= ACTIVITY_UNDO_MS,
        );
      if (reverse) {
        undone.add(fact);
        undone.add(reverse);
      }
    }
    return undone;
  }

  private toUndoKey(fact: ActivityFact) {
    return [fact.value ?? '', ...fact.users.toSorted()].join('|');
  }

  private isSetup(fact: ActivityFact, creations: ActivityFact[]) {
    return creations.some(
      (creation) =>
        creation.mergeRequestIid === fact.mergeRequestIid &&
        fact.time >= creation.time &&
        ((ACTIVITY_SETUP_FACTS.has(fact.kind) && fact.time - creation.time <= ACTIVITY_SETUP_MS) ||
          ACTIVITY_EDIT_FACTS.has(fact.kind)),
    );
  }

  private isAutomaticStatus(fact: ActivityFact, facts: ActivityFact[]) {
    return (
      fact.kind === SourceActionKind.STATUS_SET &&
      facts.some(
        (other) =>
          ACTIVITY_LIFECYCLE_FACTS.has(other.kind) &&
          other.mergeRequestIid === fact.mergeRequestIid &&
          Math.abs(other.time - fact.time) <= ACTIVITY_AUTO_STATUS_MS,
      )
    );
  }

  private isClosedByMerge(fact: ActivityFact, merges: ActivityFact[]) {
    return (
      fact.kind === SourceActionKind.CLOSED &&
      fact.mergeRequestIid === null &&
      merges.some(
        (merge) => fact.time >= merge.time && fact.time - merge.time <= ACTIVITY_MERGE_CLOSE_MS,
      )
    );
  }

  private isSelfApproval(fact: ActivityFact, ownMergeRequests: number[]) {
    return (
      fact.kind === SourceActionKind.APPROVED &&
      fact.mergeRequestIid !== null &&
      ownMergeRequests.includes(fact.mergeRequestIid)
    );
  }

  private isSelfReviewRemoval(fact: ActivityFact, employee: ActivityEmployee) {
    return (
      fact.kind === SourceActionKind.REVIEW_REQUEST_REMOVED &&
      fact.users.length === 1 &&
      fact.users[0] === employee.username
    );
  }

  private isReplaced(fact: ActivityFact, facts: ActivityFact[]) {
    const addition = ACTIVITY_SWAP_FACTS.get(fact.kind);
    return facts.some(
      (other) =>
        other.kind === addition &&
        other.mergeRequestIid === fact.mergeRequestIid &&
        Math.abs(other.time - fact.time) <= ACTIVITY_SWAP_MS,
    );
  }

  private isRepeated(fact: ActivityFact, before: ActivityFact[]) {
    return (
      ACTIVITY_SETUP_FACTS.has(fact.kind) &&
      before.some(
        (other) =>
          other.kind === fact.kind &&
          other.value === fact.value &&
          other.mergeRequestIid !== fact.mergeRequestIid &&
          fact.time - other.time <= ACTIVITY_UNDO_MS,
      )
    );
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

  private hasDialog(own: ActivityFact[], others: ActivityFact[]) {
    const onMergeRequests = (fact: ActivityFact) =>
      fact.kind === SourceActionKind.COMMENTED && fact.mergeRequestIid !== null;
    return own.some(onMergeRequests) && others.some(onMergeRequests);
  }
}
