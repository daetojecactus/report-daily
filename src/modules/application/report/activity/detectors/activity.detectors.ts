import { Injectable } from '@nestjs/common';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import { TRAIT_STATE_WEIGHTS } from 'src/modules/application/trait/constants/trait.constants';
import {
  Priority,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/types/trait.enums';
import {
  ACTIVITY_COMMENT_FACTS,
  ACTIVITY_EDIT_DETAILS,
  ACTIVITY_RETURN_STATES,
  ACTIVITY_REVIEW_FACTS,
} from '../constants/activity-facts.constants';
import { ACTIVITY_MANY_COMMENTS } from '../constants/activity.constants';
import { ACTIVITY_WEIGHTS } from '../constants/activity-weights.constants';
import { ActivityAction, ActivityDetail } from '../types/activity.enums';
import { ActivityCodeDetector } from './activity-code.detector';
import { ActivityEventDetector } from './activity-event.detector';
import { ActivityLifecycleDetector } from './activity-lifecycle.detector';
import { ActivityLinkDetector } from './activity-link.detector';
import { ActivityPlanDetector } from './activity-plan.detector';
import { ActivityRefDetector } from './activity-ref.detector';
import type {
  ActivityCandidate,
  ActivityFact,
  ActivityLineSignals,
} from '../types/activity.interface';

@Injectable()
export class ActivityDetectors {
  constructor(
    private readonly activityLifecycleDetector: ActivityLifecycleDetector,
    private readonly activityCodeDetector: ActivityCodeDetector,
    private readonly activityRefDetector: ActivityRefDetector,
    private readonly activityPlanDetector: ActivityPlanDetector,
    private readonly activityLinkDetector: ActivityLinkDetector,
    private readonly activityEventDetector: ActivityEventDetector,
  ) {}

  detect(signals: ActivityLineSignals): ActivityCandidate[] {
    const candidates = [
      ...this.activityLifecycleDetector.detect(signals),
      ...this.detectChanges(signals),
      ...this.detectReview(signals),
      ...this.activityCodeDetector.detect(signals),
      ...this.activityRefDetector.detect(signals),
      ...this.activityPlanDetector.detect(signals),
      ...this.activityLinkDetector.detect(signals),
      ...this.activityEventDetector.detect(signals),
      ...this.detectDiscussion(signals),
    ];
    return [...candidates, ...this.detectEdits(signals, candidates), this.toStateOnly(signals)];
  }

  private detectChanges(signals: ActivityLineSignals): ActivityCandidate[] {
    const { returnedAt, assignee } = signals;
    const testing = [...signals.startStates, ...signals.endStates].includes(WorkflowState.TESTING);
    const candidates: ActivityCandidate[] = [];
    for (const { fact, state, flags, priority, returnedFrom } of signals.changes) {
      const back = returnedFrom && !assignee ? ACTIVITY_RETURN_STATES.get(returnedFrom) : undefined;
      if (state === WorkflowState.CHANGES_REQUESTED || back) {
        candidates.push(
          this.toCandidate(
            ActivityAction.RETURNED,
            ACTIVITY_WEIGHTS.RETURNED,
            [fact],
            [back ?? ActivityDetail.AFTER_REVIEW],
          ),
        );
      } else if (state) {
        const again =
          state === WorkflowState.READY_FOR_QA && returnedAt !== null && returnedAt < fact.time;
        candidates.push(
          this.toCandidate(
            ActivityAction.STATE_SET,
            TRAIT_STATE_WEIGHTS[state],
            [fact],
            again ? [ActivityDetail.AFTER_QA] : [],
            state,
          ),
        );
      }
      if (flags.includes(TaskFlag.RETURNED_FROM_QA)) {
        candidates.push(
          this.toCandidate(
            ActivityAction.RETURNED,
            ACTIVITY_WEIGHTS.RETURNED,
            [fact],
            [ActivityDetail.AFTER_QA],
          ),
        );
      }
      if (priority === Priority.CRITICAL) {
        candidates.push(
          signals.kinds.includes(TaskKind.BUG) && testing
            ? this.toCandidate(ActivityAction.RELEASE_BLOCKED, ACTIVITY_WEIGHTS.RELEASE_BLOCKED, [
                fact,
              ])
            : this.toCandidate(ActivityAction.ESCALATED, ACTIVITY_WEIGHTS.ESCALATED, [fact]),
        );
      }
    }
    return candidates;
  }

  private detectReview(signals: ActivityLineSignals): ActivityCandidate[] {
    const { own, ownMergeRequests, employee } = signals;
    const candidates: ActivityCandidate[] = [];
    const rework =
      signals.startStates.includes(WorkflowState.CHANGES_REQUESTED) ||
      signals.changes.some((change) => change.state === WorkflowState.CHANGES_REQUESTED);
    for (const fact of own) {
      if (fact.kind === SourceActionKind.APPROVED) {
        candidates.push(
          this.toCandidate(
            ActivityAction.APPROVED,
            ACTIVITY_WEIGHTS.APPROVED,
            [fact],
            [
              ...(rework ? [ActivityDetail.AFTER_REWORK] : []),
              ...(signals.dependencies ? [ActivityDetail.DEPENDENCIES] : []),
            ],
          ),
        );
      } else if (fact.kind === SourceActionKind.UNAPPROVED) {
        candidates.push(
          this.toCandidate(ActivityAction.UNAPPROVED, ACTIVITY_WEIGHTS.UNAPPROVED, [fact]),
        );
      } else if (
        fact.kind === SourceActionKind.REVIEW_REQUESTED &&
        fact.users.includes(employee.username)
      ) {
        candidates.push(
          this.toCandidate(ActivityAction.TOOK_REVIEW, ACTIVITY_WEIGHTS.TOOK_REVIEW, [fact]),
        );
      } else if (
        fact.kind === SourceActionKind.REVIEW_REQUESTED ||
        fact.kind === SourceActionKind.MARKED_READY
      ) {
        candidates.push(
          this.toCandidate(
            ActivityAction.STATE_SET,
            TRAIT_STATE_WEIGHTS[WorkflowState.REVIEW],
            [fact],
            [ActivityDetail.REVIEW_REQUEST],
            WorkflowState.REVIEW,
          ),
        );
      }
    }
    const remarks = own.filter(
      (fact) =>
        ACTIVITY_REVIEW_FACTS.has(fact.kind) &&
        fact.mergeRequestIid !== null &&
        !ownMergeRequests.includes(fact.mergeRequestIid),
    );
    if (remarks.length) {
      const many =
        remarks.filter((fact) => fact.kind === SourceActionKind.COMMENTED).length >=
        ACTIVITY_MANY_COMMENTS;
      candidates.push(
        this.toCandidate(
          ActivityAction.REVIEWED,
          many ? ACTIVITY_WEIGHTS.REVIEWED_MANY : ACTIVITY_WEIGHTS.REVIEWED,
          remarks,
          [
            ...(many ? [ActivityDetail.MANY] : []),
            ...(remarks.some((fact) => fact.kind === SourceActionKind.THREADS_RESOLVED)
              ? [ActivityDetail.RESOLVED]
              : []),
            ...(remarks.some((fact) => fact.kind === SourceActionKind.CHANGES_REQUESTED)
              ? [ActivityDetail.CHANGES_REQUESTED]
              : []),
          ],
        ),
      );
    }
    return candidates;
  }

  private detectDiscussion(signals: ActivityLineSignals): ActivityCandidate[] {
    const { own, ownMergeRequests } = signals;
    const candidates: ActivityCandidate[] = [];
    const requirements = own.filter(
      (fact) => fact.kind === SourceActionKind.DESCRIPTION_CHANGED && fact.mergeRequestIid === null,
    );
    if (requirements.length) {
      const edited = Math.max(...requirements.map((fact) => fact.time));
      candidates.push(
        this.toCandidate(
          ActivityAction.REQUIREMENTS,
          ACTIVITY_WEIGHTS.REQUIREMENTS,
          requirements,
          signals.others.some(
            (fact) =>
              fact.kind === SourceActionKind.COMMENTED &&
              fact.mergeRequestIid === null &&
              fact.time < edited,
          )
            ? [ActivityDetail.AFTER_DISCUSSION]
            : [],
        ),
      );
    }
    const assignments = own.filter(
      (fact) =>
        fact.kind === SourceActionKind.ASSIGNED || fact.kind === SourceActionKind.UNASSIGNED,
    );
    if (assignments.length) {
      candidates.push(
        this.toCandidate(
          ActivityAction.ASSIGNED,
          ACTIVITY_WEIGHTS.ASSIGNED,
          assignments,
          assignments.some((fact) => fact.kind === SourceActionKind.ASSIGNED)
            ? []
            : [ActivityDetail.UNASSIGNED],
        ),
      );
    }
    const comments = own.filter(
      (fact) =>
        ACTIVITY_COMMENT_FACTS.has(fact.kind) &&
        (fact.mergeRequestIid === null || ownMergeRequests.includes(fact.mergeRequestIid)),
    );
    if (comments.length) {
      candidates.push(
        signals.dialog
          ? this.toCandidate(ActivityAction.DISCUSSED, ACTIVITY_WEIGHTS.DISCUSSED, comments, [
              ActivityDetail.DIALOG,
            ])
          : this.toCandidate(ActivityAction.COMMENTED, ACTIVITY_WEIGHTS.COMMENTED, comments),
      );
    }
    return candidates;
  }

  private detectEdits({ own }: ActivityLineSignals, candidates: ActivityCandidate[]) {
    const used = new Set(candidates.flatMap((candidate) => candidate.facts));
    const edits = new Map<ActivityDetail, ActivityFact[]>();
    for (const fact of own) {
      const detail = ACTIVITY_EDIT_DETAILS.get(fact.kind);
      if (detail && !used.has(fact)) {
        edits.set(detail, [...(edits.get(detail) ?? []), fact]);
      }
    }
    return [...edits].map(([detail, facts]) =>
      this.toCandidate(ActivityAction.EDITED, ACTIVITY_WEIGHTS.EDITED, facts, [detail]),
    );
  }

  private toStateOnly({ endStates }: ActivityLineSignals) {
    return this.toCandidate(
      ActivityAction.STATE_ONLY,
      ACTIVITY_WEIGHTS.STATE_ONLY,
      [],
      [],
      endStates.at(-1) ?? null,
    );
  }

  private toCandidate(
    action: ActivityAction,
    weight: number,
    facts: ActivityFact[],
    details: ActivityDetail[] = [],
    state: WorkflowState | null = null,
  ): ActivityCandidate {
    return {
      action,
      weight,
      time: facts.length ? Math.max(...facts.map((fact) => fact.time)) : 0,
      state,
      details,
      facts,
      parts: [],
    };
  }
}
