import { Injectable } from '@nestjs/common';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import type { SourceTextChange } from 'src/modules/application/source/types/source.interface';
import type { WorkflowState } from 'src/modules/application/trait/types/trait.enums';
import { ACTIVITY_COMMENT_FACTS } from '../constants/activity-facts.constants';
import {
  ACTIVITY_DESCRIPTION_REWORK,
  ACTIVITY_DESCRIPTION_SMALL,
  ACTIVITY_DESCRIPTION_WRITTEN_BEFORE,
} from '../constants/activity.constants';
import { ACTIVITY_WEIGHTS } from '../constants/activity-weights.constants';
import { ActivityAction, ActivityDetail, ActivityRule } from '../types/activity.enums';
import type {
  ActivityCandidate,
  ActivityFact,
  ActivityLineSignals,
} from '../types/activity.interface';

@Injectable()
export class ActivityDiscussionDetector {
  detect(signals: ActivityLineSignals): ActivityCandidate[] {
    const { own, ownMergeRequests } = signals;
    const candidates: ActivityCandidate[] = [];
    const requirements = own.filter(
      (fact) => fact.kind === SourceActionKind.DESCRIPTION_CHANGED && fact.mergeRequestIid === null,
    );
    if (requirements.length) {
      const edited = Math.max(...requirements.map((fact) => fact.time));
      const size = this.toDescriptionSize(requirements);
      candidates.push(
        this.toCandidate(
          ActivityAction.REQUIREMENTS,
          size === ActivityDetail.CORRECTED
            ? ACTIVITY_WEIGHTS.REQUIREMENTS_CORRECTED
            : ACTIVITY_WEIGHTS.REQUIREMENTS,
          requirements,
          [
            ...(size ? [size] : []),
            ...(signals.others.some(
              (fact) =>
                fact.kind === SourceActionKind.COMMENTED &&
                fact.mergeRequestIid === null &&
                fact.time < edited,
            )
              ? [ActivityDetail.AFTER_DISCUSSION]
              : []),
          ],
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
          this.toAssignmentDetails(signals, assignments),
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

  private toDescriptionSize(facts: ActivityFact[]) {
    const changes = facts
      .map((fact) => fact.change)
      .filter((change): change is SourceTextChange => change !== undefined);
    const [first] = changes;
    if (!first) {
      return null;
    }
    const added = changes.reduce((total, change) => total + change.added, 0);
    const removed = changes.reduce((total, change) => total + change.removed, 0);
    if (
      first.before < ACTIVITY_DESCRIPTION_WRITTEN_BEFORE &&
      added >= ACTIVITY_DESCRIPTION_SMALL &&
      added >= first.before * 2
    ) {
      return ActivityDetail.WRITTEN;
    }
    if (added + removed < ACTIVITY_DESCRIPTION_SMALL) {
      return ActivityDetail.CORRECTED;
    }
    if (removed * 2 <= added) {
      return ActivityDetail.EXPANDED;
    }
    return added + removed < ACTIVITY_DESCRIPTION_REWORK
      ? ActivityDetail.CORRECTED
      : ActivityDetail.REWORKED;
  }

  private toAssignmentDetails(
    { employee, dropped }: ActivityLineSignals,
    assignments: ActivityFact[],
  ) {
    const changes = [
      ...assignments,
      ...dropped
        .filter(
          ({ fact, rule }) =>
            rule === ActivityRule.REPLACED && fact.kind === SourceActionKind.UNASSIGNED,
        )
        .map(({ fact }) => fact),
    ];
    const last = Math.max(...changes.map((fact) => fact.time));
    const users = (kind: SourceActionKind) =>
      changes
        .filter((fact) => fact.kind === kind && fact.time === last)
        .flatMap((fact) => fact.users);
    const added = users(SourceActionKind.ASSIGNED);
    const removed = users(SourceActionKind.UNASSIGNED);
    const me = employee.username;
    if (added.includes(me)) {
      return [ActivityDetail.TAKEN];
    }
    if (added.length) {
      if (removed.includes(me)) {
        return [ActivityDetail.HANDED_OVER];
      }
      return removed.length ? [ActivityDetail.REASSIGNED] : [];
    }
    return [removed.includes(me) ? ActivityDetail.LEFT : ActivityDetail.UNASSIGNED];
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
