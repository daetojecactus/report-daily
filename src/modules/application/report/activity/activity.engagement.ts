import { Injectable } from '@nestjs/common';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import { Priority } from 'src/modules/application/trait/types/trait.enums';
import {
  ENGAGEMENT_COMMENT_CAP,
  ENGAGEMENT_COMMIT_CAP,
  ENGAGEMENT_STATE_CHANGE_CAP,
  ENGAGEMENT_THRESHOLDS,
  ENGAGEMENT_WEIGHTS,
} from './constants/activity.constants';
import { EngagementLevel } from './types/activity.enums';
import type { ActivityLineSignals } from './types/activity.interface';

@Injectable()
export class ActivityEngagement {
  resolve({ own, changes, pushes, line, employee, assignee }: ActivityLineSignals) {
    const has = (kind: SourceActionKind) => own.some((fact) => fact.kind === kind);
    const reviewer =
      line.mergeRequests.some((mergeRequest) =>
        mergeRequest.reviewers.includes(employee.username),
      ) || has(SourceActionKind.APPROVED);
    const commits = pushes.reduce((total, push) => total + push.commitCount, 0);
    const comments = own.filter((fact) => fact.kind === SourceActionKind.COMMENTED).length;
    const stateChanges = changes.filter((change) => change.state).length;
    const score =
      (assignee ? ENGAGEMENT_WEIGHTS.ASSIGNEE : 0) +
      (reviewer ? ENGAGEMENT_WEIGHTS.REVIEWER : 0) +
      (line.mergeRequests.some((mergeRequest) => mergeRequest.author === employee.username)
        ? ENGAGEMENT_WEIGHTS.MERGE_REQUEST_AUTHOR
        : 0) +
      (has(SourceActionKind.MERGED) ? ENGAGEMENT_WEIGHTS.MERGED : 0) +
      (own.some((fact) => fact.kind === SourceActionKind.OPENED && fact.mergeRequestIid === null)
        ? ENGAGEMENT_WEIGHTS.ISSUE_AUTHOR
        : 0) +
      (changes.some((change) => change.priority === Priority.CRITICAL)
        ? ENGAGEMENT_WEIGHTS.PRIORITY_ESCALATION
        : 0) +
      Math.min(commits, ENGAGEMENT_COMMIT_CAP) * ENGAGEMENT_WEIGHTS.PER_COMMIT +
      Math.min(comments, ENGAGEMENT_COMMENT_CAP) * ENGAGEMENT_WEIGHTS.PER_COMMENT +
      Math.min(stateChanges, ENGAGEMENT_STATE_CHANGE_CAP) * ENGAGEMENT_WEIGHTS.PER_STATE_CHANGE;
    if (score >= ENGAGEMENT_THRESHOLDS.PRIMARY) {
      return EngagementLevel.PRIMARY;
    }
    if (score >= ENGAGEMENT_THRESHOLDS.SECONDARY) {
      return EngagementLevel.SECONDARY;
    }
    return score >= ENGAGEMENT_THRESHOLDS.MINOR ? EngagementLevel.MINOR : EngagementLevel.OBSERVER;
  }
}
