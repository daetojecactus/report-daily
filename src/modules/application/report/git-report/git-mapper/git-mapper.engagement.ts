import {
  ENGAGEMENT_COMMENT_CAP,
  ENGAGEMENT_COMMIT_CAP,
  ENGAGEMENT_THRESHOLDS,
  ENGAGEMENT_WEIGHTS,
} from './constants/git-mapper.constants';
import { EngagementLevel } from './git-mapper.enums';
import { EngagementResult, EngagementSignals } from './git-mapper.interface';

export function calculateEngagement(
  signals: EngagementSignals,
): EngagementResult {
  let score = 0;

  if (signals.isAssignee) score += ENGAGEMENT_WEIGHTS.ASSIGNEE;
  if (signals.isReviewer) score += ENGAGEMENT_WEIGHTS.REVIEWER;
  if (signals.isMergeRequestAuthor) {
    score += ENGAGEMENT_WEIGHTS.MERGE_REQUEST_AUTHOR;
  }
  if (signals.mergedMergeRequest) score += ENGAGEMENT_WEIGHTS.MERGED;
  if (signals.isIssueAuthor) score += ENGAGEMENT_WEIGHTS.ISSUE_AUTHOR;
  if (signals.escalatedPriority) {
    score += ENGAGEMENT_WEIGHTS.PRIORITY_ESCALATION;
  }

  score +=
    Math.min(signals.commitCount, ENGAGEMENT_COMMIT_CAP) *
    ENGAGEMENT_WEIGHTS.PER_COMMIT;
  score +=
    Math.min(signals.commentCount, ENGAGEMENT_COMMENT_CAP) *
    ENGAGEMENT_WEIGHTS.PER_COMMENT;
  score += signals.statusChangesCount * ENGAGEMENT_WEIGHTS.PER_STATUS_CHANGE;

  return { score, level: resolveLevel(score) };
}

function resolveLevel(score: number): EngagementLevel {
  if (score >= ENGAGEMENT_THRESHOLDS.PRIMARY) return EngagementLevel.PRIMARY;
  if (score >= ENGAGEMENT_THRESHOLDS.SECONDARY) {
    return EngagementLevel.SECONDARY;
  }
  if (score >= ENGAGEMENT_THRESHOLDS.MINOR) return EngagementLevel.MINOR;
  return EngagementLevel.OBSERVER;
}
