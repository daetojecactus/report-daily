import { Injectable } from '@nestjs/common';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import { TRAIT_STATE_WEIGHTS } from 'src/modules/application/trait/constants/trait.constants';
import {
  Priority,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/trait.enums';
import {
  ACTIVITY_COMMENT_FACTS,
  ACTIVITY_EDIT_DETAILS,
  ACTIVITY_MANY_COMMENTS,
  ACTIVITY_REVIEW_FACTS,
  ACTIVITY_WEIGHTS,
} from './constants/activity.constants';
import { ActivityAction, ActivityDetail } from './activity.enums';
import { ActivityCodeDetector } from './activity-code.detector';
import type { ActivityCandidate, ActivityFact, ActivityLineSignals } from './activity.interface';

@Injectable()
export class ActivityDetectors {
  constructor(private readonly activityCodeDetector: ActivityCodeDetector) {}

  detect(signals: ActivityLineSignals): ActivityCandidate[] {
    const candidates = [
      ...this.detectLifecycle(signals),
      ...this.detectChanges(signals),
      ...this.detectReview(signals),
      ...this.activityCodeDetector.detect(signals),
      ...this.detectDiscussion(signals),
    ];
    return [...candidates, ...this.detectEdits(signals, candidates), this.toStateOnly(signals)];
  }

  private detectLifecycle(signals: ActivityLineSignals): ActivityCandidate[] {
    const { own, ownMergeRequests, kind, endStates, line, assignee, closedToday } = signals;
    const dependencies = signals.dependencies ? [ActivityDetail.DEPENDENCIES] : [];
    const candidates: ActivityCandidate[] = [];
    for (const fact of own) {
      if (fact.kind === SourceActionKind.MERGED && fact.mergeRequestIid !== null) {
        candidates.push(
          ownMergeRequests.includes(fact.mergeRequestIid)
            ? this.toCandidate(ActivityAction.MERGED, ACTIVITY_WEIGHTS.MERGED, [fact], dependencies)
            : this.toCandidate(
                ActivityAction.MERGED_OTHER,
                ACTIVITY_WEIGHTS.MERGED_OTHER,
                [fact],
                dependencies,
              ),
        );
      } else if (fact.kind === SourceActionKind.CLOSED) {
        candidates.push(
          this.toCandidate(
            ActivityAction.CLOSED,
            ACTIVITY_WEIGHTS.CLOSED,
            [fact],
            fact.mergeRequestIid === null ? [] : [ActivityDetail.MERGE_REQUEST],
          ),
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
    const ownOutcome = candidates.some((candidate) =>
      [ActivityAction.CLOSED, ActivityAction.MERGED].includes(candidate.action),
    );
    if (line.issue && closedToday && assignee && !ownOutcome) {
      candidates.push(
        this.toCandidate(
          ActivityAction.COMPLETED,
          ACTIVITY_WEIGHTS.COMPLETED,
          [],
          signals.mergedToday ? [ActivityDetail.WITH_MERGE] : [],
        ),
      );
    }
    return candidates;
  }

  private detectChanges({ changes, returnedAt }: ActivityLineSignals): ActivityCandidate[] {
    return changes.flatMap(({ fact, state, flags, priority }) => [
      ...(state === WorkflowState.CHANGES_REQUESTED
        ? [
            this.toCandidate(
              ActivityAction.RETURNED,
              ACTIVITY_WEIGHTS.RETURNED,
              [fact],
              [ActivityDetail.AFTER_REVIEW],
            ),
          ]
        : state
          ? [
              this.toCandidate(
                ActivityAction.STATE_SET,
                TRAIT_STATE_WEIGHTS[state],
                [fact],
                state === WorkflowState.READY_FOR_QA &&
                  returnedAt !== null &&
                  returnedAt < fact.time
                  ? [ActivityDetail.AFTER_QA]
                  : [],
                state,
              ),
            ]
          : []),
      ...(flags.includes(TaskFlag.RETURNED_FROM_QA)
        ? [
            this.toCandidate(
              ActivityAction.RETURNED,
              ACTIVITY_WEIGHTS.RETURNED,
              [fact],
              [ActivityDetail.AFTER_QA],
            ),
          ]
        : []),
      ...(priority === Priority.CRITICAL
        ? [this.toCandidate(ActivityAction.ESCALATED, ACTIVITY_WEIGHTS.ESCALATED, [fact])]
        : []),
    ]);
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
      const dialog = signals.dialog && !signals.pushes.length;
      candidates.push(
        dialog
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
