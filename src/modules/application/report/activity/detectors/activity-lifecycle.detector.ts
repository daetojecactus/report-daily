import { Injectable } from '@nestjs/common';
import { SOURCE_CLOSED_BY_MERGE_REQUEST } from 'src/modules/application/source/constants/source.constants';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import { Priority, TaskKind, WorkflowState } from 'src/modules/application/trait/types/trait.enums';
import { ACTIVITY_PASSED_SKIPPED_DETAILS } from '../constants/activity.constants';
import { ACTIVITY_WEIGHTS } from '../constants/activity-weights.constants';
import { ActivityAction, ActivityDetail, ActivityRule } from '../types/activity.enums';
import type {
  ActivityCandidate,
  ActivityFact,
  ActivityLineSignals,
} from '../types/activity.interface';

@Injectable()
export class ActivityLifecycleDetector {
  detect(signals: ActivityLineSignals): ActivityCandidate[] {
    const { own, ownMergeRequests, kind, endStates, line } = signals;
    const everyMergeRequest = line.mergeRequests.map((mergeRequest) => mergeRequest.iid);
    const closedByMerge = signals.dropped.some(
      (item) => item.rule === ActivityRule.CLOSED_BY_MERGE,
    );
    const candidates: ActivityCandidate[] = [];
    for (const fact of own) {
      if (fact.kind === SourceActionKind.MERGED && fact.mergeRequestIid !== null) {
        const ownWork = ownMergeRequests.includes(fact.mergeRequestIid);
        candidates.push(
          this.toCandidate(
            ownWork ? ActivityAction.MERGED : ActivityAction.MERGED_OTHER,
            ownWork ? ACTIVITY_WEIGHTS.MERGED : ACTIVITY_WEIGHTS.MERGED_OTHER,
            [fact],
            [
              ...this.toContext(signals, fact.time, [fact.mergeRequestIid]),
              ...(closedByMerge ? [ActivityDetail.CLOSES] : []),
            ],
          ),
        );
      } else if (fact.kind === SourceActionKind.CLOSED) {
        const duplicates =
          fact.mergeRequestIid === null
            ? own.filter(
                (other) =>
                  other.kind === SourceActionKind.DUPLICATE_MARKED &&
                  other.mergeRequestIid === null,
              )
            : [];
        candidates.push(
          this.toCandidate(
            ActivityAction.CLOSED,
            ACTIVITY_WEIGHTS.CLOSED,
            [fact, ...duplicates],
            [
              ...(fact.mergeRequestIid === null ? [] : [ActivityDetail.MERGE_REQUEST]),
              ...(this.isClosedByMergeRequest(fact) ? [ActivityDetail.WITH_MERGE] : []),
              ...(duplicates.length ? [ActivityDetail.DUPLICATE] : []),
              ...this.toContext(
                signals,
                fact.time,
                fact.mergeRequestIid === null ? everyMergeRequest : [fact.mergeRequestIid],
              ),
            ],
          ),
        );
      } else if (fact.kind === SourceActionKind.AUTO_MERGE_SET && fact.mergeRequestIid !== null) {
        candidates.push(
          this.toCandidate(ActivityAction.MERGE_SCHEDULED, ACTIVITY_WEIGHTS.MERGE_SCHEDULED, [
            fact,
          ]),
        );
      } else if (fact.kind === SourceActionKind.REOPENED) {
        candidates.push(
          this.toCandidate(ActivityAction.REOPENED, ACTIVITY_WEIGHTS.REOPENED, [fact]),
        );
      } else if (fact.kind === SourceActionKind.OPENED && fact.mergeRequestIid === null) {
        candidates.push(
          kind === TaskKind.BUG
            ? this.toCandidate(
                ActivityAction.BUG_FOUND,
                ACTIVITY_WEIGHTS.BUG_FOUND,
                [fact],
                endStates.includes(WorkflowState.TESTING) ? [ActivityDetail.REGRESSION] : [],
              )
            : this.toCandidate(ActivityAction.CREATED, ACTIVITY_WEIGHTS.CREATED, [fact]),
        );
      }
    }
    return [
      ...candidates,
      ...this.detectCompleted(signals, candidates, everyMergeRequest),
      ...this.detectPassed(signals, everyMergeRequest),
    ];
  }

  private detectCompleted(
    signals: ActivityLineSignals,
    candidates: ActivityCandidate[],
    everyMergeRequest: number[],
  ): ActivityCandidate[] {
    const ownOutcome = candidates.some(
      (candidate) =>
        candidate.action === ActivityAction.CLOSED || candidate.action === ActivityAction.MERGED,
    );
    const movedAway = [...signals.others, ...signals.dropped.map(({ fact }) => fact)].some(
      (fact) => fact.kind === SourceActionKind.MOVED_OUT && fact.mergeRequestIid === null,
    );
    if (
      !signals.line.issue ||
      !signals.closedToday ||
      !signals.assignee ||
      ownOutcome ||
      movedAway
    ) {
      return [];
    }
    const closing = signals.others.find(
      (fact) => fact.kind === SourceActionKind.CLOSED && fact.mergeRequestIid === null,
    );
    const time = closing?.time ?? Number.MAX_SAFE_INTEGER;
    const completed = this.toCandidate(
      ActivityAction.COMPLETED,
      ACTIVITY_WEIGHTS.COMPLETED,
      [],
      [
        ...(signals.mergedToday || (closing && this.isClosedByMergeRequest(closing))
          ? [ActivityDetail.WITH_MERGE]
          : []),
        ...this.toContext(signals, time, everyMergeRequest),
      ],
    );
    return [{ ...completed, time: closing?.time ?? 0 }];
  }

  private detectPassed(
    signals: ActivityLineSignals,
    everyMergeRequest: number[],
  ): ActivityCandidate[] {
    const passed = signals.otherChanges.findLast(
      (change) => change.state === WorkflowState.QA_PASSED,
    );
    const ownPass = signals.changes.some((change) => change.state === WorkflowState.QA_PASSED);
    if (!passed || ownPass || !signals.assignee) {
      return [];
    }
    const candidate = this.toCandidate(
      ActivityAction.PASSED,
      ACTIVITY_WEIGHTS.PASSED,
      [],
      this.toContext(signals, passed.fact.time, everyMergeRequest).filter(
        (detail) => !ACTIVITY_PASSED_SKIPPED_DETAILS.has(detail),
      ),
    );
    return [{ ...candidate, time: passed.fact.time }];
  }

  private isClosedByMergeRequest(fact: ActivityFact) {
    return fact.mergeRequestIid === null && fact.value === SOURCE_CLOSED_BY_MERGE_REQUEST;
  }

  private toContext(signals: ActivityLineSignals, time: number, iids: number[]) {
    const onMergeRequests = (fact: ActivityFact) =>
      fact.time <= time && fact.mergeRequestIid !== null && iids.includes(fact.mergeRequestIid);
    const tested =
      signals.startStates.includes(WorkflowState.QA_PASSED) ||
      [...signals.changes, ...signals.otherChanges].some(
        (change) => change.state === WorkflowState.QA_PASSED && change.fact.time <= time,
      );
    const reviewed =
      signals.line.mergeRequests.some(
        (mergeRequest) => iids.includes(mergeRequest.iid) && mergeRequest.reviewThreads.total > 0,
      ) ||
      signals.others.some(
        (fact) => fact.kind === SourceActionKind.REVIEW_SUBMITTED && onMergeRequests(fact),
      );
    return [
      ...(tested ? [ActivityDetail.TESTED] : []),
      ...(signals.others.some(
        (fact) => fact.kind === SourceActionKind.APPROVED && onMergeRequests(fact),
      )
        ? [ActivityDetail.AFTER_APPROVAL]
        : []),
      ...(signals.returnedAt !== null && signals.returnedAt < time
        ? [ActivityDetail.AFTER_REWORK]
        : []),
      ...(reviewed ? [ActivityDetail.AFTER_REVIEW] : []),
      ...(signals.priority === Priority.CRITICAL || signals.kinds.includes(TaskKind.HOTFIX)
        ? [ActivityDetail.URGENT]
        : []),
      ...(signals.dependencies ? [ActivityDetail.DEPENDENCIES] : []),
    ];
  }

  private toCandidate(
    action: ActivityAction,
    weight: number,
    facts: ActivityFact[],
    details: ActivityDetail[] = [],
  ): ActivityCandidate {
    return {
      action,
      weight,
      time: facts.length ? Math.max(...facts.map((fact) => fact.time)) : 0,
      state: null,
      details,
      facts,
      parts: [],
    };
  }
}
