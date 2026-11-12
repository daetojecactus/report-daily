import { TaskFlag, TaskKind, WorkflowState } from 'src/modules/application/trait/types/trait.enums';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { ActivityAction, ActivityDetail } from '../../activity/types/activity.enums';
import { ReportPhrase } from '../types/phrase.enums';
import type { PhraseRule } from '../types/phrase.interface';

const MANAGERS = [JobRole.PROJECT_MANAGER, JobRole.SYSTEM_ANALYST];

const ENGINEERS = [JobRole.DEVELOPER, JobRole.QA, JobRole.DEVOPS];

const OUTCOMES: PhraseRule[] = [
  {
    action: ActivityAction.MERGED,
    details: [ActivityDetail.DEPENDENCIES],
    phrase: ReportPhrase.DEPENDENCIES_UPDATED,
  },
  {
    action: ActivityAction.MERGED,
    kinds: [TaskKind.HOTFIX],
    phrase: ReportPhrase.HOTFIX_RELEASED,
  },
  {
    action: ActivityAction.MERGED,
    details: [ActivityDetail.URGENT],
    issue: false,
    phrase: ReportPhrase.HOTFIX_RELEASED,
  },
  {
    action: ActivityAction.MERGED,
    flags: [TaskFlag.E2E_REQUIRED],
    roles: [JobRole.QA],
    phrase: ReportPhrase.E2E_DEVELOPED,
  },
  {
    action: ActivityAction.MERGED,
    kinds: [TaskKind.QA_INTERNAL],
    phrase: ReportPhrase.AUTOTESTS_DEVELOPED,
  },
  {
    action: ActivityAction.MERGED,
    kinds: [TaskKind.TEST_AUTOMATION],
    phrase: ReportPhrase.AUTOTESTS_DEVELOPED,
  },
  { action: ActivityAction.MERGED, kinds: [TaskKind.BUG], phrase: ReportPhrase.BUG_FIXED },
  {
    action: ActivityAction.MERGED,
    kinds: [TaskKind.INCIDENT],
    phrase: ReportPhrase.INCIDENT_RESOLVED,
  },
  {
    action: ActivityAction.MERGED,
    kinds: [TaskKind.FEATURE],
    phrase: ReportPhrase.FEATURE_IMPLEMENTED,
  },
  {
    action: ActivityAction.MERGED,
    kinds: [TaskKind.IMPROVEMENT],
    phrase: ReportPhrase.IMPROVEMENT_DONE,
  },
  {
    action: ActivityAction.MERGED,
    kinds: [TaskKind.MAINTENANCE],
    phrase: ReportPhrase.TECH_DEBT_PAID,
  },
  {
    action: ActivityAction.MERGED,
    kinds: [TaskKind.DOCUMENTATION],
    phrase: ReportPhrase.DOCUMENTATION_WRITTEN,
  },
  {
    action: ActivityAction.MERGED,
    kinds: [TaskKind.RELEASE],
    phrase: ReportPhrase.RELEASE_PREPARED,
  },
  { action: ActivityAction.MERGED, issue: false, phrase: ReportPhrase.MERGE_REQUEST_MERGED },
  { action: ActivityAction.MERGED, phrase: ReportPhrase.COMPLETED_BY_MERGE },
  {
    action: ActivityAction.MERGED_OTHER,
    details: [ActivityDetail.WITH_APPROVAL],
    phrase: ReportPhrase.APPROVED_AND_MERGED,
  },
  {
    action: ActivityAction.MERGED_OTHER,
    details: [ActivityDetail.DEPENDENCIES],
    phrase: ReportPhrase.DEPENDENCIES_MERGED,
  },
  { action: ActivityAction.MERGED_OTHER, phrase: ReportPhrase.OTHERS_MERGED },
  {
    action: ActivityAction.CLOSED,
    details: [ActivityDetail.WITH_MERGE],
    phrase: ReportPhrase.COMPLETED_BY_MERGE,
  },
  {
    action: ActivityAction.CLOSED,
    details: [ActivityDetail.MERGE_REQUEST],
    phrase: ReportPhrase.MERGE_REQUEST_CLOSED,
  },
  {
    action: ActivityAction.CLOSED,
    details: [ActivityDetail.DUPLICATE],
    phrase: ReportPhrase.DUPLICATE_CLOSED,
  },
  { action: ActivityAction.CLOSED, roles: [JobRole.QA], phrase: ReportPhrase.FIX_VERIFIED },
  {
    action: ActivityAction.CLOSED,
    kinds: [TaskKind.FEATURE],
    roles: MANAGERS,
    phrase: ReportPhrase.CHECKED_AND_CLOSED,
  },
  { action: ActivityAction.CLOSED, roles: MANAGERS, phrase: ReportPhrase.WORK_ACCEPTED },
  {
    action: ActivityAction.CLOSED,
    roles: [JobRole.DEVELOPER, JobRole.DEVOPS],
    assignee: true,
    merged: false,
    phrase: ReportPhrase.CLOSED_WITHOUT_MERGE,
  },
  { action: ActivityAction.CLOSED, phrase: ReportPhrase.TASK_CLOSED },
  { action: ActivityAction.MILESTONE_CLOSED, phrase: ReportPhrase.MILESTONE_CLOSED },
  {
    action: ActivityAction.COMPLETED,
    details: [ActivityDetail.WITH_MERGE],
    phrase: ReportPhrase.COMPLETED_AND_MERGED,
  },
  { action: ActivityAction.COMPLETED, phrase: ReportPhrase.TASK_COMPLETED },
  {
    action: ActivityAction.REOPENED,
    details: [ActivityDetail.MILESTONE],
    phrase: ReportPhrase.MILESTONE_REOPENED,
  },
  { action: ActivityAction.REOPENED, kinds: [TaskKind.BUG], phrase: ReportPhrase.BUG_REOPENED },
  { action: ActivityAction.REOPENED, phrase: ReportPhrase.TASK_REOPENED },
  { action: ActivityAction.RELEASED, phrase: ReportPhrase.VERSION_RELEASED },
];

const CHECKS: PhraseRule[] = [
  {
    action: ActivityAction.APPROVED,
    details: [ActivityDetail.DEPENDENCIES],
    phrase: ReportPhrase.DEPENDENCIES_APPROVED,
  },
  {
    action: ActivityAction.APPROVED,
    details: [ActivityDetail.AFTER_REWORK],
    roles: [JobRole.QA],
    phrase: ReportPhrase.APPROVED_AFTER_REWORK,
  },
  {
    action: ActivityAction.APPROVED,
    roles: [JobRole.QA],
    phrase: ReportPhrase.TESTED_AND_APPROVED,
  },
  {
    action: ActivityAction.APPROVED,
    details: [ActivityDetail.AFTER_REWORK],
    phrase: ReportPhrase.FIXES_ACCEPTED,
  },
  { action: ActivityAction.APPROVED, phrase: ReportPhrase.MERGE_REQUEST_APPROVED },
  { action: ActivityAction.UNAPPROVED, phrase: ReportPhrase.APPROVAL_WITHDRAWN },
  {
    action: ActivityAction.RETURNED,
    details: [ActivityDetail.WITH_REMARKS],
    roles: [JobRole.QA],
    phrase: ReportPhrase.TESTED_AND_RETURNED_WITH_REMARKS,
  },
  {
    action: ActivityAction.RETURNED,
    details: [ActivityDetail.WITH_REMARKS],
    phrase: ReportPhrase.RETURNED_WITH_REMARKS,
  },
  {
    action: ActivityAction.RETURNED,
    details: [ActivityDetail.WITH_TESTING],
    phrase: ReportPhrase.TESTED_AND_RETURNED,
  },
  {
    action: ActivityAction.RETURNED,
    details: [ActivityDetail.AFTER_QA],
    phrase: ReportPhrase.RETURNED_TO_DEVELOPMENT,
  },
  { action: ActivityAction.RETURNED, phrase: ReportPhrase.RETURNED_FOR_REWORK },
  {
    action: ActivityAction.PASSED,
    details: [ActivityDetail.WITH_CODE],
    phrase: ReportPhrase.FINISHED_AND_PASSED_TESTING,
  },
  { action: ActivityAction.PASSED, phrase: ReportPhrase.PASSED_TESTING },
  { action: ActivityAction.RELEASE_BLOCKED, phrase: ReportPhrase.RELEASE_BLOCKED },
  {
    action: ActivityAction.REVIEWED,
    details: [ActivityDetail.MANY],
    roles: [JobRole.QA],
    phrase: ReportPhrase.TESTED_WITH_REMARKS,
  },
  {
    action: ActivityAction.REVIEWED,
    details: [ActivityDetail.CHANGES_REQUESTED],
    roles: [JobRole.QA],
    phrase: ReportPhrase.TESTED_WITH_REMARKS,
  },
  {
    action: ActivityAction.REVIEWED,
    details: [ActivityDetail.RESOLVED],
    roles: [JobRole.QA],
    phrase: ReportPhrase.FIXES_CHECKED,
  },
  {
    action: ActivityAction.REVIEWED,
    roles: [JobRole.QA, ...MANAGERS],
    phrase: ReportPhrase.COMMENTED,
  },
  {
    action: ActivityAction.REVIEWED,
    details: [ActivityDetail.CHANGES_REQUESTED],
    phrase: ReportPhrase.CHANGES_REQUESTED,
  },
  {
    action: ActivityAction.REVIEWED,
    details: [ActivityDetail.MANY],
    phrase: ReportPhrase.CHANGES_REQUESTED,
  },
  {
    action: ActivityAction.REVIEWED,
    details: [ActivityDetail.RESOLVED],
    phrase: ReportPhrase.FIXES_CHECKED,
  },
  { action: ActivityAction.REVIEWED, phrase: ReportPhrase.CODE_REMARKS },
  {
    action: ActivityAction.BUG_FOUND,
    details: [ActivityDetail.REGRESSION],
    phrase: ReportPhrase.REGRESSION_FOUND,
  },
  { action: ActivityAction.BUG_FOUND, roles: [JobRole.QA], phrase: ReportPhrase.BUG_FOUND },
  { action: ActivityAction.BUG_FOUND, roles: MANAGERS, phrase: ReportPhrase.BUG_REPORTED },
  { action: ActivityAction.BUG_FOUND, phrase: ReportPhrase.BUG_FOUND_DURING_WORK },
];

const TRANSITIONS: PhraseRule[] = [
  {
    action: ActivityAction.STATE_SET,
    states: [WorkflowState.QA_PASSED],
    details: [ActivityDetail.WITH_APPROVAL],
    phrase: ReportPhrase.TESTED_AND_APPROVED,
  },
  {
    action: ActivityAction.STATE_SET,
    states: [WorkflowState.QA_PASSED],
    roles: [JobRole.QA],
    phrase: ReportPhrase.TESTED_WITHOUT_REMARKS,
  },
  {
    action: ActivityAction.STATE_SET,
    states: [WorkflowState.READY_FOR_QA],
    details: [ActivityDetail.AFTER_QA],
    phrase: ReportPhrase.RESUBMITTED_TO_TESTING,
  },
  {
    action: ActivityAction.STATE_SET,
    states: [WorkflowState.REVIEW],
    details: [ActivityDetail.WITH_CODE],
    phrase: ReportPhrase.FINISHED_AND_SENT_TO_REVIEW,
  },
  {
    action: ActivityAction.STATE_SET,
    states: [WorkflowState.READY_FOR_QA],
    details: [ActivityDetail.WITH_CODE],
    phrase: ReportPhrase.FINISHED_AND_SENT_TO_TESTING,
  },
  ...(
    [
      [WorkflowState.BACKLOG, ReportPhrase.MOVED_TO_BACKLOG],
      [WorkflowState.PLANNED, ReportPhrase.PLANNED_FOR_SPRINT],
      [WorkflowState.ANALYSIS, ReportPhrase.TAKEN_INTO_ANALYSIS],
      [WorkflowState.DESIGN, ReportPhrase.SENT_TO_DESIGN],
      [WorkflowState.IN_PROGRESS, ReportPhrase.TAKEN_INTO_WORK],
      [WorkflowState.REVIEW, ReportPhrase.SENT_TO_REVIEW],
      [WorkflowState.CHANGES_REQUESTED, ReportPhrase.RETURNED_FOR_REWORK],
      [WorkflowState.READY_FOR_QA, ReportPhrase.SENT_TO_TESTING],
      [WorkflowState.TESTING, ReportPhrase.TESTING_TASK],
      [WorkflowState.QA_PASSED, ReportPhrase.MARKED_TESTED],
      [WorkflowState.READY_FOR_RELEASE, ReportPhrase.READY_FOR_RELEASE],
      [WorkflowState.STAGING, ReportPhrase.DEPLOYED_TO_STAGING],
      [WorkflowState.RELEASED, ReportPhrase.MARKED_RELEASED],
      [WorkflowState.DONE, ReportPhrase.MARKED_DONE],
      [WorkflowState.CANCELLED, ReportPhrase.TASK_CANCELLED],
      [WorkflowState.BLOCKED, ReportPhrase.PUT_ON_HOLD],
      [WorkflowState.NEEDS_INFO, ReportPhrase.ASKED_FOR_DETAILS],
      [WorkflowState.HANDOFF, ReportPhrase.HANDED_OFF],
    ] as const
  ).map(([state, phrase]) => ({ action: ActivityAction.STATE_SET, states: [state], phrase })),
  { action: ActivityAction.STATE_SET, phrase: ReportPhrase.WORKED_ON_TASK },
  { action: ActivityAction.ESCALATED, phrase: ReportPhrase.PRIORITY_RAISED },
  { action: ActivityAction.MERGE_SCHEDULED, phrase: ReportPhrase.MERGE_SCHEDULED },
];

const WORK: PhraseRule[] = [
  {
    action: ActivityAction.TOOK_REVIEW,
    roles: [JobRole.QA],
    phrase: ReportPhrase.TOOK_FOR_TESTING,
  },
  { action: ActivityAction.TOOK_REVIEW, phrase: ReportPhrase.TOOK_FOR_REVIEW },
  {
    action: ActivityAction.ASSIGNED_REVIEW,
    details: [ActivityDetail.UNASSIGNED],
    phrase: ReportPhrase.REVIEW_HANDED_OVER,
  },
  { action: ActivityAction.ASSIGNED_REVIEW, phrase: ReportPhrase.REVIEWER_ASSIGNED },
  {
    action: ActivityAction.CODE,
    flags: [TaskFlag.E2E_REQUIRED],
    roles: [JobRole.QA],
    phrase: ReportPhrase.E2E_IN_PROGRESS,
  },
  {
    action: ActivityAction.CODE,
    flags: [TaskFlag.E2E_REQUIRED],
    details: [ActivityDetail.TESTS],
    phrase: ReportPhrase.E2E_IN_PROGRESS,
  },
  {
    action: ActivityAction.CODE,
    kinds: [TaskKind.QA_INTERNAL, TaskKind.MAINTENANCE],
    phrase: ReportPhrase.AUTOTESTS_MAINTAINED,
  },
  {
    action: ActivityAction.CODE,
    kinds: [TaskKind.TEST_AUTOMATION, TaskKind.MAINTENANCE],
    phrase: ReportPhrase.AUTOTESTS_MAINTAINED,
  },
  {
    action: ActivityAction.CODE,
    kinds: [TaskKind.QA_INTERNAL],
    phrase: ReportPhrase.AUTOTESTS_IN_PROGRESS,
  },
  {
    action: ActivityAction.CODE,
    kinds: [TaskKind.TEST_AUTOMATION],
    phrase: ReportPhrase.AUTOTESTS_IN_PROGRESS,
  },
  ...(
    [
      [ActivityDetail.DEPENDENCIES, ReportPhrase.DEPENDENCIES_IN_PROGRESS],
      [ActivityDetail.RESOLVED, ReportPhrase.REVIEW_REMARKS_RESOLVED],
      [ActivityDetail.AFTER_REVIEW, ReportPhrase.FIXING_REVIEW_REMARKS],
      [ActivityDetail.AFTER_QA, ReportPhrase.FIXING_TESTING_REMARKS],
      [ActivityDetail.REBASE, ReportPhrase.CONFLICTS_RESOLVED],
      [ActivityDetail.TESTS, ReportPhrase.TESTS_WRITTEN],
    ] as const
  ).map(([detail, phrase]) => ({ action: ActivityAction.CODE, details: [detail], phrase })),
  {
    action: ActivityAction.CODE,
    details: [ActivityDetail.STARTED],
    pushed: true,
    phrase: ReportPhrase.IMPLEMENTATION_STARTED,
  },
  ...(
    [
      [ActivityDetail.STARTED, ReportPhrase.WORK_STARTED],
      [ActivityDetail.RESUMED, ReportPhrase.WORK_RESUMED],
      [ActivityDetail.REFACTORING, ReportPhrase.REFACTORED],
      [ActivityDetail.DRAFT, ReportPhrase.DRAFT_IN_PROGRESS],
      [ActivityDetail.DIRECT, ReportPhrase.COMMITTED_TO_MAIN_BRANCH],
      [ActivityDetail.MANY, ReportPhrase.PUSHED_TO_BRANCHES],
    ] as const
  ).map(([detail, phrase]) => ({ action: ActivityAction.CODE, details: [detail], phrase })),
  { action: ActivityAction.CODE, phrase: ReportPhrase.CODE_WORK },
  {
    action: ActivityAction.REQUIREMENTS,
    details: [ActivityDetail.WITH_STATE],
    states: [WorkflowState.PLANNED],
    phrase: ReportPhrase.REQUIREMENTS_AND_PLANNED,
  },
  {
    action: ActivityAction.REQUIREMENTS,
    details: [ActivityDetail.WITH_STATE],
    states: [WorkflowState.IN_PROGRESS],
    phrase: ReportPhrase.REQUIREMENTS_AND_TAKEN_INTO_WORK,
  },
  {
    action: ActivityAction.REQUIREMENTS,
    roles: ENGINEERS,
    phrase: ReportPhrase.DESCRIPTION_UPDATED,
  },
  {
    action: ActivityAction.REQUIREMENTS,
    details: [ActivityDetail.AFTER_DISCUSSION],
    phrase: ReportPhrase.REQUIREMENTS_AFTER_DISCUSSION,
  },
  { action: ActivityAction.REQUIREMENTS, phrase: ReportPhrase.REQUIREMENTS_CLARIFIED },
  { action: ActivityAction.DECOMPOSED, phrase: ReportPhrase.DECOMPOSED },
  {
    action: ActivityAction.DOCUMENTED,
    details: [ActivityDetail.NEW_PAGE],
    phrase: ReportPhrase.DOCUMENTATION_PAGE_CREATED,
  },
  { action: ActivityAction.DOCUMENTED, phrase: ReportPhrase.DOCUMENTATION_UPDATED },
  {
    action: ActivityAction.PLANNED,
    details: [ActivityDetail.NEW_MILESTONE],
    phrase: ReportPhrase.MILESTONE_CREATED,
  },
  {
    action: ActivityAction.PLANNED,
    details: [ActivityDetail.ITERATION, ActivityDetail.MOVED],
    phrase: ReportPhrase.MOVED_TO_ANOTHER_SPRINT,
  },
  {
    action: ActivityAction.PLANNED,
    details: [ActivityDetail.ITERATION],
    phrase: ReportPhrase.ADDED_TO_SPRINT,
  },
  {
    action: ActivityAction.PLANNED,
    details: [ActivityDetail.MILESTONE, ActivityDetail.MOVED],
    phrase: ReportPhrase.MOVED_TO_ANOTHER_MILESTONE,
  },
  {
    action: ActivityAction.PLANNED,
    details: [ActivityDetail.MILESTONE],
    phrase: ReportPhrase.ADDED_TO_MILESTONE,
  },
  {
    action: ActivityAction.PLANNED,
    details: [ActivityDetail.DUE_DATE],
    phrase: ReportPhrase.DUE_DATE_SET,
  },
  {
    action: ActivityAction.PLANNED,
    details: [ActivityDetail.START_DATE],
    phrase: ReportPhrase.START_DATE_SET,
  },
  { action: ActivityAction.PLANNED, phrase: ReportPhrase.TASK_PLANNED },
  {
    action: ActivityAction.TAGGED,
    details: [ActivityDetail.MANY],
    phrase: ReportPhrase.TAGS_PUSHED,
  },
  { action: ActivityAction.TAGGED, phrase: ReportPhrase.TAG_CREATED },
];

const PARTICIPATION: PhraseRule[] = [
  {
    action: ActivityAction.CREATED,
    kinds: [TaskKind.MAINTENANCE],
    roles: ENGINEERS,
    phrase: ReportPhrase.TECH_DEBT_RECORDED,
  },
  {
    action: ActivityAction.CREATED,
    kinds: [TaskKind.FEATURE],
    roles: MANAGERS,
    phrase: ReportPhrase.FEATURE_PLANNED,
  },
  { action: ActivityAction.CREATED, phrase: ReportPhrase.TASK_CREATED },
  { action: ActivityAction.MOVED, phrase: ReportPhrase.MOVED_FROM_PROJECT },
  ...(
    [
      [ActivityDetail.DUPLICATE, ReportPhrase.DUPLICATE_MARKED],
      [ActivityDetail.BLOCKED_BY, ReportPhrase.BLOCKER_MARKED],
      [ActivityDetail.PARENT, ReportPhrase.PARENT_SET],
    ] as const
  ).map(([detail, phrase]) => ({ action: ActivityAction.LINKED, details: [detail], phrase })),
  { action: ActivityAction.LINKED, phrase: ReportPhrase.TASKS_LINKED },
  { action: ActivityAction.DISCUSSED, phrase: ReportPhrase.SOLUTION_DISCUSSED },
  { action: ActivityAction.HELPED, kinds: [TaskKind.BUG], phrase: ReportPhrase.HELPED_FIX_BUG },
  { action: ActivityAction.HELPED, phrase: ReportPhrase.HELPED_WITH_TASK },
  {
    action: ActivityAction.ASSIGNED,
    details: [ActivityDetail.UNASSIGNED],
    phrase: ReportPhrase.ASSIGNEE_REMOVED,
  },
  { action: ActivityAction.ASSIGNED, phrase: ReportPhrase.TASK_ASSIGNED },
  {
    action: ActivityAction.PRIORITIZED,
    details: [ActivityDetail.CHANGED],
    phrase: ReportPhrase.PRIORITY_CHANGED,
  },
  { action: ActivityAction.PRIORITIZED, phrase: ReportPhrase.PRIORITY_SET },
  {
    action: ActivityAction.ESTIMATED,
    details: [ActivityDetail.CHANGED],
    phrase: ReportPhrase.ESTIMATE_CHANGED,
  },
  { action: ActivityAction.ESTIMATED, phrase: ReportPhrase.TASK_ESTIMATED },
  ...(
    [
      [ActivityDetail.TITLE, ReportPhrase.TASK_RENAMED],
      [ActivityDetail.DESCRIPTION, ReportPhrase.DESCRIPTION_EDITED],
      [ActivityDetail.LABELS, ReportPhrase.LABELS_UPDATED],
      [ActivityDetail.STATUS, ReportPhrase.STATUS_UPDATED],
      [ActivityDetail.DRAFT, ReportPhrase.MARKED_DRAFT],
      [ActivityDetail.REVIEWERS, ReportPhrase.REVIEWERS_CHANGED],
      [ActivityDetail.ITERATION, ReportPhrase.REMOVED_FROM_SPRINT],
      [ActivityDetail.MILESTONE, ReportPhrase.REMOVED_FROM_MILESTONE],
      [ActivityDetail.WEIGHT, ReportPhrase.ESTIMATE_REMOVED],
      [ActivityDetail.LINKS, ReportPhrase.LINK_REMOVED],
      [ActivityDetail.DUE_DATE, ReportPhrase.DUE_DATE_REMOVED],
      [ActivityDetail.START_DATE, ReportPhrase.START_DATE_REMOVED],
      [ActivityDetail.AUTO_MERGE, ReportPhrase.AUTO_MERGE_CANCELLED],
    ] as const
  ).map(([detail, phrase]) => ({ action: ActivityAction.EDITED, details: [detail], phrase })),
  { action: ActivityAction.EDITED, phrase: ReportPhrase.TASK_UPDATED },
  ...(
    [
      [ActivityDetail.TAG, ReportPhrase.TAG_DELETED],
      [ActivityDetail.WIKI, ReportPhrase.DOCUMENTATION_PAGE_DELETED],
      [ActivityDetail.MILESTONE, ReportPhrase.MILESTONE_DELETED],
      [ActivityDetail.MANY, ReportPhrase.BRANCHES_DELETED],
    ] as const
  ).map(([detail, phrase]) => ({ action: ActivityAction.DELETED, details: [detail], phrase })),
  { action: ActivityAction.DELETED, phrase: ReportPhrase.BRANCH_DELETED },
  {
    action: ActivityAction.COMMENTED,
    roles: MANAGERS,
    endStates: [WorkflowState.NEEDS_INFO],
    phrase: ReportPhrase.REQUIREMENTS_CLARIFIED,
  },
  {
    action: ActivityAction.COMMENTED,
    kinds: [TaskKind.BUG],
    roles: [JobRole.QA],
    phrase: ReportPhrase.BUG_DETAILS_CLARIFIED,
  },
  { action: ActivityAction.COMMENTED, phrase: ReportPhrase.COMMENTED },
  { action: ActivityAction.STATE_ONLY, phrase: ReportPhrase.WORKED_ON_TASK },
];

export const PHRASE_RULES: PhraseRule[] = [
  ...OUTCOMES,
  ...CHECKS,
  ...TRANSITIONS,
  ...WORK,
  ...PARTICIPATION,
];
