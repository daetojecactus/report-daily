import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import { WorkflowState } from 'src/modules/application/trait/types/trait.enums';
import { ActivityDetail } from '../types/activity.enums';

export const ACTIVITY_OPPOSITE_FACTS = new Map<SourceActionKind, SourceActionKind>([
  [SourceActionKind.LABEL_ADDED, SourceActionKind.LABEL_REMOVED],
  [SourceActionKind.LABEL_REMOVED, SourceActionKind.LABEL_ADDED],
  [SourceActionKind.ASSIGNED, SourceActionKind.UNASSIGNED],
  [SourceActionKind.UNASSIGNED, SourceActionKind.ASSIGNED],
  [SourceActionKind.REVIEW_REQUESTED, SourceActionKind.REVIEW_REQUEST_REMOVED],
  [SourceActionKind.REVIEW_REQUEST_REMOVED, SourceActionKind.REVIEW_REQUESTED],
  [SourceActionKind.APPROVED, SourceActionKind.UNAPPROVED],
  [SourceActionKind.UNAPPROVED, SourceActionKind.APPROVED],
  [SourceActionKind.MARKED_DRAFT, SourceActionKind.MARKED_READY],
  [SourceActionKind.MARKED_READY, SourceActionKind.MARKED_DRAFT],
  [SourceActionKind.CLOSED, SourceActionKind.REOPENED],
  [SourceActionKind.REOPENED, SourceActionKind.CLOSED],
  [SourceActionKind.MILESTONE_SET, SourceActionKind.MILESTONE_REMOVED],
  [SourceActionKind.MILESTONE_REMOVED, SourceActionKind.MILESTONE_SET],
  [SourceActionKind.ITERATION_SET, SourceActionKind.ITERATION_REMOVED],
  [SourceActionKind.ITERATION_REMOVED, SourceActionKind.ITERATION_SET],
  [SourceActionKind.WEIGHT_SET, SourceActionKind.WEIGHT_REMOVED],
  [SourceActionKind.WEIGHT_REMOVED, SourceActionKind.WEIGHT_SET],
  [SourceActionKind.DUE_DATE_SET, SourceActionKind.DUE_DATE_REMOVED],
  [SourceActionKind.DUE_DATE_REMOVED, SourceActionKind.DUE_DATE_SET],
  [SourceActionKind.START_DATE_SET, SourceActionKind.START_DATE_REMOVED],
  [SourceActionKind.START_DATE_REMOVED, SourceActionKind.START_DATE_SET],
  [SourceActionKind.AUTO_MERGE_SET, SourceActionKind.AUTO_MERGE_CANCELED],
  [SourceActionKind.AUTO_MERGE_CANCELED, SourceActionKind.AUTO_MERGE_SET],
]);

export const ACTIVITY_RETURN_STATES = new Map<WorkflowState, ActivityDetail>([
  [WorkflowState.REVIEW, ActivityDetail.AFTER_REVIEW],
  [WorkflowState.CHANGES_REQUESTED, ActivityDetail.AFTER_REVIEW],
  [WorkflowState.READY_FOR_QA, ActivityDetail.AFTER_QA],
  [WorkflowState.TESTING, ActivityDetail.AFTER_QA],
]);

export const ACTIVITY_SWAP_FACTS = new Map<SourceActionKind, SourceActionKind>([
  [SourceActionKind.LABEL_REMOVED, SourceActionKind.LABEL_ADDED],
  [SourceActionKind.UNASSIGNED, SourceActionKind.ASSIGNED],
  [SourceActionKind.REVIEW_REQUEST_REMOVED, SourceActionKind.REVIEW_REQUESTED],
  [SourceActionKind.MILESTONE_REMOVED, SourceActionKind.MILESTONE_SET],
  [SourceActionKind.ITERATION_REMOVED, SourceActionKind.ITERATION_SET],
]);

export const ACTIVITY_SETUP_FACTS = new Set<SourceActionKind>([
  SourceActionKind.LABEL_ADDED,
  SourceActionKind.LABEL_REMOVED,
  SourceActionKind.STATUS_SET,
  SourceActionKind.ASSIGNED,
  SourceActionKind.UNASSIGNED,
  SourceActionKind.MILESTONE_SET,
  SourceActionKind.MILESTONE_REMOVED,
  SourceActionKind.ITERATION_SET,
  SourceActionKind.ITERATION_REMOVED,
  SourceActionKind.WEIGHT_SET,
  SourceActionKind.WEIGHT_REMOVED,
  SourceActionKind.LINKED,
  SourceActionKind.UNLINKED,
  SourceActionKind.CHILD_ADDED,
  SourceActionKind.DUE_DATE_SET,
  SourceActionKind.DUE_DATE_REMOVED,
  SourceActionKind.START_DATE_SET,
  SourceActionKind.START_DATE_REMOVED,
]);

export const ACTIVITY_LINK_DETAILS = new Map<string, ActivityDetail>([
  ['related to', ActivityDetail.RELATED],
  ['blocking', ActivityDetail.BLOCKING],
  ['blocked by', ActivityDetail.BLOCKED_BY],
  ['parent', ActivityDetail.PARENT],
  ['epic', ActivityDetail.PARENT],
  ['duplicate', ActivityDetail.DUPLICATE],
]);

export const ACTIVITY_PLAN_FACTS = new Map<SourceActionKind, ActivityDetail>([
  [SourceActionKind.ITERATION_SET, ActivityDetail.ITERATION],
  [SourceActionKind.MILESTONE_SET, ActivityDetail.MILESTONE],
  [SourceActionKind.DUE_DATE_SET, ActivityDetail.DUE_DATE],
  [SourceActionKind.START_DATE_SET, ActivityDetail.START_DATE],
]);

export const ACTIVITY_EDIT_FACTS = new Set<SourceActionKind>([
  SourceActionKind.DESCRIPTION_CHANGED,
  SourceActionKind.TITLE_CHANGED,
]);

export const ACTIVITY_LIFECYCLE_FACTS = new Set<SourceActionKind>([
  SourceActionKind.OPENED,
  SourceActionKind.CLOSED,
  SourceActionKind.REOPENED,
  SourceActionKind.MERGED,
]);

export const ACTIVITY_CODE_FACTS = new Set<SourceActionKind>([
  SourceActionKind.PUSHED,
  SourceActionKind.BRANCH_CREATED,
  SourceActionKind.DIFF_LINE_CHANGED,
  SourceActionKind.COMMIT_MENTIONED,
]);

export const ACTIVITY_CODE_CHANGE_FACTS = new Set<SourceActionKind>([
  SourceActionKind.PUSHED,
  SourceActionKind.DIFF_LINE_CHANGED,
  SourceActionKind.COMMIT_MENTIONED,
]);

export const ACTIVITY_COMMIT_FACTS = new Set<SourceActionKind>([
  SourceActionKind.PUSHED,
  SourceActionKind.COMMIT_MENTIONED,
]);

export const ACTIVITY_REVIEW_FACTS = new Set<SourceActionKind>([
  SourceActionKind.COMMENTED,
  SourceActionKind.REVIEW_SUBMITTED,
  SourceActionKind.THREADS_RESOLVED,
  SourceActionKind.CHANGES_REQUESTED,
]);

export const ACTIVITY_COMMENT_FACTS = new Set<SourceActionKind>([
  SourceActionKind.COMMENTED,
  SourceActionKind.REVIEW_SUBMITTED,
]);

export const ACTIVITY_EDIT_DETAILS = new Map<SourceActionKind, ActivityDetail>([
  [SourceActionKind.TITLE_CHANGED, ActivityDetail.TITLE],
  [SourceActionKind.DESCRIPTION_CHANGED, ActivityDetail.DESCRIPTION],
  [SourceActionKind.LABEL_ADDED, ActivityDetail.LABELS],
  [SourceActionKind.LABEL_REMOVED, ActivityDetail.LABELS],
  [SourceActionKind.STATUS_SET, ActivityDetail.STATUS],
  [SourceActionKind.MARKED_DRAFT, ActivityDetail.DRAFT],
  [SourceActionKind.REVIEW_REQUEST_REMOVED, ActivityDetail.REVIEWERS],
  [SourceActionKind.ITERATION_REMOVED, ActivityDetail.ITERATION],
  [SourceActionKind.MILESTONE_REMOVED, ActivityDetail.MILESTONE],
  [SourceActionKind.WEIGHT_REMOVED, ActivityDetail.WEIGHT],
  [SourceActionKind.UNLINKED, ActivityDetail.LINKS],
  [SourceActionKind.DUE_DATE_REMOVED, ActivityDetail.DUE_DATE],
  [SourceActionKind.START_DATE_REMOVED, ActivityDetail.START_DATE],
  [SourceActionKind.AUTO_MERGE_CANCELED, ActivityDetail.AUTO_MERGE],
]);
