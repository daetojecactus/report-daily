import { Injectable } from '@nestjs/common';
import { SourceActionKind, SourceRefType } from 'src/modules/application/source/types/source.enums';
import { TaskFlag, TaskKind, WorkflowState } from 'src/modules/application/trait/types/trait.enums';
import { ACTIVITY_BRANCH_PUSH_ACTION } from '../constants/activity-events.constants';
import {
  ACTIVITY_CODE_CHANGE_FACTS,
  ACTIVITY_CODE_FACTS,
  ACTIVITY_COMMIT_FACTS,
} from '../constants/activity-facts.constants';
import { ACTIVITY_CODE_WEIGHTS, ACTIVITY_WEIGHTS } from '../constants/activity-weights.constants';
import {
  ACTIVITY_DAY_MS,
  ACTIVITY_RESUMED_WORK_DAYS,
} from '../constants/activity-windows.constants';
import { ACTIVITY_TEST_COMMIT_PATTERN } from '../constants/activity-patterns.constants';
import { ActivityAction, ActivityDetail, EngagementLevel } from '../types/activity.enums';
import type {
  ActivityCandidate,
  ActivityFact,
  ActivityLine,
  ActivityLineSignals,
  ActivityPush,
} from '../types/activity.interface';

@Injectable()
export class ActivityCodeDetector {
  detect(signals: ActivityLineSignals): ActivityCandidate[] {
    const { own, pushes, ownMergeRequests } = signals;
    const isWork = (fact: ActivityFact) =>
      ACTIVITY_CODE_FACTS.has(fact.kind) ||
      (fact.mergeRequestIid !== null &&
        (fact.kind === SourceActionKind.OPENED ||
          (fact.kind === SourceActionKind.THREADS_RESOLVED &&
            ownMergeRequests.includes(fact.mergeRequestIid))));
    const changed =
      pushes.length > 0 || own.some((fact) => ACTIVITY_CODE_CHANGE_FACTS.has(fact.kind));
    const facts = own.filter(
      (fact) => isWork(fact) || (changed && fact.kind === SourceActionKind.MARKED_DRAFT),
    );
    if (!changed) {
      return facts.length ? [this.toCode(facts, this.toStartDetails(signals, facts), [])] : [];
    }
    if (this.isHelping(signals)) {
      return [
        this.toCandidate(
          ActivityAction.HELPED,
          ACTIVITY_WEIGHTS.HELPED,
          facts,
          signals.dialog ? [ActivityDetail.DIALOG] : [],
          pushes,
        ),
      ];
    }
    return [this.toCode(facts, this.toCodeDetails(signals, facts), pushes)];
  }

  private isHelping({
    pushes,
    ownMergeRequests,
    assignee,
    engagement,
    dependencies,
  }: ActivityLineSignals) {
    return (
      !dependencies &&
      !assignee &&
      pushes.length > 0 &&
      pushes.every(
        (push) => push.mergeRequestIid !== null && !ownMergeRequests.includes(push.mergeRequestIid),
      ) &&
      (engagement === EngagementLevel.SECONDARY || engagement === EngagementLevel.MINOR)
    );
  }

  private toStartDetails(signals: ActivityLineSignals, facts: ActivityFact[]) {
    const has = (kind: SourceActionKind) => facts.some((fact) => fact.kind === kind);
    return [
      ...(has(SourceActionKind.BRANCH_CREATED) || has(SourceActionKind.OPENED)
        ? [ActivityDetail.STARTED]
        : []),
      ...(has(SourceActionKind.THREADS_RESOLVED) ? [ActivityDetail.RESOLVED] : []),
      ...(signals.dependencies ? [ActivityDetail.DEPENDENCIES] : []),
    ];
  }

  private toCodeDetails(signals: ActivityLineSignals, facts: ActivityFact[]) {
    const { pushes, others, removedFlags, line, kind } = signals;
    const has = (sourceKind: SourceActionKind) => facts.some((fact) => fact.kind === sourceKind);
    const firstPush = Math.min(
      ...pushes.map((push) => push.time),
      ...facts.filter((fact) => ACTIVITY_COMMIT_FACTS.has(fact.kind)).map((fact) => fact.time),
    );
    const details: ActivityDetail[] = [];
    const worked = line.mergeRequests.filter(
      (mergeRequest) =>
        pushes.some((push) => push.mergeRequestIid === mergeRequest.iid) ||
        facts.some(
          (fact) =>
            fact.mergeRequestIid === mergeRequest.iid && ACTIVITY_CODE_CHANGE_FACTS.has(fact.kind),
        ),
    );
    const underReview =
      [...signals.startStates, ...signals.endStates].some(
        (state) => state === WorkflowState.REVIEW || state === WorkflowState.CHANGES_REQUESTED,
      ) ||
      worked.some(
        (mergeRequest) =>
          mergeRequest.reviewers.length > 0 || mergeRequest.startOfDay.reviewers.length > 0,
      );
    if (
      has(SourceActionKind.DIFF_LINE_CHANGED) ||
      worked.some((mergeRequest) => mergeRequest.reviewThreads.total > 0) ||
      (underReview &&
        others.some(
          (fact) =>
            fact.kind === SourceActionKind.COMMENTED &&
            fact.mergeRequestIid !== null &&
            fact.time < firstPush,
        ))
    ) {
      details.push(ActivityDetail.AFTER_REVIEW);
    }
    if (
      has(SourceActionKind.THREADS_RESOLVED) ||
      worked.some(({ reviewThreads }) => reviewThreads.total > 0 && reviewThreads.unresolved === 0)
    ) {
      details.push(ActivityDetail.RESOLVED);
    }
    if (signals.returnedAt !== null && signals.returnedAt < firstPush) {
      details.push(ActivityDetail.AFTER_QA);
    }
    if (removedFlags.includes(TaskFlag.NEEDS_REBASE)) {
      details.push(ActivityDetail.REBASE);
    }
    if (
      pushes.some((push) =>
        push.commitTitles.some((title) => ACTIVITY_TEST_COMMIT_PATTERN.test(title)),
      )
    ) {
      details.push(ActivityDetail.TESTS);
    }
    if (
      has(SourceActionKind.BRANCH_CREATED) ||
      has(SourceActionKind.OPENED) ||
      [...line.mergeRequests, ...line.pushes.filter((push) => push.ref !== null)].some(
        ({ events }) => events.some((event) => event.actionName === ACTIVITY_BRANCH_PUSH_ACTION),
      )
    ) {
      details.push(ActivityDetail.STARTED);
    }
    if (
      signals.lastCommitAt !== null &&
      Number.isFinite(firstPush) &&
      firstPush - signals.lastCommitAt > ACTIVITY_RESUMED_WORK_DAYS * ACTIVITY_DAY_MS
    ) {
      details.push(ActivityDetail.RESUMED);
    }
    if (kind === TaskKind.MAINTENANCE) {
      details.push(ActivityDetail.REFACTORING);
    }
    if (
      has(SourceActionKind.MARKED_DRAFT) ||
      signals.endFlags.includes(TaskFlag.DRAFT) ||
      line.mergeRequests.some(
        (mergeRequest) =>
          mergeRequest.draft && pushes.some((push) => push.mergeRequestIid === mergeRequest.iid),
      )
    ) {
      details.push(ActivityDetail.DRAFT);
    }
    if (signals.dependencies) {
      details.push(ActivityDetail.DEPENDENCIES);
    }
    if (line.pushes.some((push) => push.mainBranch)) {
      details.push(ActivityDetail.DIRECT);
    }
    if (this.hasForeignMention(line, facts)) {
      details.push(ActivityDetail.MENTIONED);
    }
    if (line.pushes.some((push) => push.ref === null && push.refType === SourceRefType.BRANCH)) {
      details.push(ActivityDetail.MANY);
    }
    return details;
  }

  private hasForeignMention(line: ActivityLine, facts: ActivityFact[]) {
    const commits = [...line.mergeRequests, ...line.pushes].flatMap(({ events }) =>
      events.flatMap((event) => event.pushData?.commits.map((commit) => commit.id) ?? []),
    );
    return facts.some(
      (fact) =>
        fact.kind === SourceActionKind.COMMIT_MENTIONED &&
        fact.value !== null &&
        !commits.some((commit) => commit.startsWith(fact.value ?? '')),
    );
  }

  private toCode(facts: ActivityFact[], details: ActivityDetail[], pushes: ActivityPush[]) {
    const weight = Math.max(
      ACTIVITY_WEIGHTS.CODE,
      ...details.map((detail) => ACTIVITY_CODE_WEIGHTS[detail] ?? ACTIVITY_WEIGHTS.CODE),
    );
    return this.toCandidate(ActivityAction.CODE, weight, facts, details, pushes);
  }

  private toCandidate(
    action: ActivityAction,
    weight: number,
    facts: ActivityFact[],
    details: ActivityDetail[],
    pushes: ActivityPush[],
  ): ActivityCandidate {
    return {
      action,
      weight,
      time: Math.max(0, ...facts.map((fact) => fact.time), ...pushes.map((push) => push.time)),
      state: null,
      details,
      facts,
      parts: [],
    };
  }
}
