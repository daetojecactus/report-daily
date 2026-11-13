import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import { ActivityAction, ActivityDetail } from '../../activity/types/activity.enums';
import { PhraseContext, PhraseCount, PhraseName, ReportPhrase } from '../types/phrase.enums';

export const PHRASE_CONTEXTS: [ActivityDetail, PhraseContext][] = [
  [ActivityDetail.TESTED, PhraseContext.AFTER_TESTING],
  [ActivityDetail.AFTER_REWORK, PhraseContext.AFTER_REWORK],
  [ActivityDetail.AFTER_APPROVAL, PhraseContext.AFTER_APPROVAL],
  [ActivityDetail.AFTER_REVIEW, PhraseContext.AFTER_REVIEW],
  [ActivityDetail.AUTO_MERGE, PhraseContext.AUTO_MERGE],
];

export const PHRASE_CONTEXT_ACTIONS = new Set<ActivityAction>([
  ActivityAction.MERGED,
  ActivityAction.MERGED_OTHER,
  ActivityAction.CLOSED,
  ActivityAction.COMPLETED,
  ActivityAction.PASSED,
]);

export const PHRASE_CONTEXT_PARTS = new Map<PhraseContext, ActivityAction>([
  [PhraseContext.AFTER_APPROVAL, ActivityAction.APPROVED],
  [PhraseContext.AFTER_REVIEW, ActivityAction.REVIEWED],
  [PhraseContext.AFTER_TESTING, ActivityAction.PASSED],
]);

export const PHRASE_NOTED_ACTIONS = new Set<ActivityAction>([
  ActivityAction.COMMENTED,
  ActivityAction.DISCUSSED,
  ActivityAction.HELPED,
  ActivityAction.ASSIGNED,
  ActivityAction.LINKED,
  ActivityAction.ESTIMATED,
  ActivityAction.PRIORITIZED,
  ActivityAction.EDITED,
]);

export const PHRASE_NAMES = new Map<ReportPhrase, PhraseName>([
  [ReportPhrase.ADDED_TO_SPRINT, PhraseName.SPRINT],
  [ReportPhrase.MOVED_TO_ANOTHER_SPRINT, PhraseName.OTHER_SPRINT],
  [ReportPhrase.ADDED_TO_MILESTONE, PhraseName.MILESTONE],
  [ReportPhrase.MOVED_TO_ANOTHER_MILESTONE, PhraseName.OTHER_MILESTONE],
  [ReportPhrase.DUE_DATE_SET, PhraseName.DATE],
  [ReportPhrase.START_DATE_SET, PhraseName.DATE],
  [ReportPhrase.MOVED_FROM_PROJECT, PhraseName.PROJECT],
]);

export const PHRASE_NAME_FACTS: Record<PhraseName, SourceActionKind[]> = {
  [PhraseName.SPRINT]: [SourceActionKind.ITERATION_SET],
  [PhraseName.OTHER_SPRINT]: [SourceActionKind.ITERATION_SET],
  [PhraseName.MILESTONE]: [SourceActionKind.MILESTONE_SET],
  [PhraseName.OTHER_MILESTONE]: [SourceActionKind.MILESTONE_SET],
  [PhraseName.DATE]: [SourceActionKind.DUE_DATE_SET, SourceActionKind.START_DATE_SET],
  [PhraseName.PROJECT]: [SourceActionKind.MOVED_IN],
};

export const PHRASE_SUMMARY_NAMES = new Set<PhraseName>([
  PhraseName.SPRINT,
  PhraseName.OTHER_SPRINT,
  PhraseName.MILESTONE,
  PhraseName.OTHER_MILESTONE,
  PhraseName.DATE,
]);

export const PHRASE_COUNTS = new Map<ReportPhrase, PhraseCount>([
  [ReportPhrase.DECOMPOSED, PhraseCount.SUBTASKS],
  [ReportPhrase.PUSHED_TO_BRANCHES, PhraseCount.BRANCHES],
  [ReportPhrase.TAGS_PUSHED, PhraseCount.REFS],
  [ReportPhrase.BRANCHES_DELETED, PhraseCount.REFS],
]);

export const PHRASE_SUMMARIES = [
  ReportPhrase.MILESTONE_CREATED,
  ReportPhrase.MOVED_TO_ANOTHER_SPRINT,
  ReportPhrase.ADDED_TO_SPRINT,
  ReportPhrase.MOVED_TO_ANOTHER_MILESTONE,
  ReportPhrase.ADDED_TO_MILESTONE,
  ReportPhrase.DUE_DATE_SET,
  ReportPhrase.START_DATE_SET,
  ReportPhrase.TASK_PLANNED,
  ReportPhrase.ESTIMATE_CHANGED,
  ReportPhrase.TASK_ESTIMATED,
  ReportPhrase.PRIORITY_CHANGED,
  ReportPhrase.PRIORITY_SET,
  ReportPhrase.TASK_ASSIGNED,
  ReportPhrase.ASSIGNEE_REMOVED,
  ReportPhrase.MOVED_FROM_PROJECT,
] as const;
