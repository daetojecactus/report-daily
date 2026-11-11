import { TRAIT_STATE_WEIGHTS } from 'src/modules/application/trait/constants/trait.constants';
import { WorkflowState } from 'src/modules/application/trait/types/trait.enums';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { ActivityAction, ActivityDetail, ActivityTier } from '../types/activity.enums';
import type { ActivityRoleFocus } from '../types/activity.interface';

export const ACTIVITY_WEIGHTS = {
  MERGED: 950,
  CLOSED: 940,
  MERGED_OTHER: 900,
  COMPLETED: 890,
  REOPENED: 880,
  RELEASED: 930,
  MILESTONE_CLOSED: 920,
  PASSED: 785,
  APPROVED: 780,
  RETURNED: 770,
  RELEASE_BLOCKED: 765,
  REVIEWED_MANY: 760,
  BUG_FOUND: 750,
  REVIEWED: 720,
  UNAPPROVED: 700,
  MERGE_SCHEDULED: 650,
  ESCALATED: 600,
  CODE: 300,
  REQUIREMENTS: 320,
  DECOMPOSED: 320,
  DOCUMENTED: 300,
  TOOK_REVIEW: 290,
  PLANNED: TRAIT_STATE_WEIGHTS[WorkflowState.PLANNED],
  TAGGED: 260,
  CREATED: 220,
  MOVED: 215,
  LINKED: 210,
  DISCUSSED: 200,
  ASSIGNED: 200,
  HELPED: 180,
  ESTIMATED: 170,
  EDITED: 150,
  DELETED: 120,
  COMMENTED: 100,
  STATE_ONLY: 50,
} as const;

export const ACTIVITY_CODE_WEIGHTS: Partial<Record<ActivityDetail, number>> = {
  [ActivityDetail.AFTER_REVIEW]: 350,
  [ActivityDetail.RESOLVED]: 350,
  [ActivityDetail.AFTER_QA]: 345,
  [ActivityDetail.REBASE]: 340,
  [ActivityDetail.TESTS]: 330,
  [ActivityDetail.STARTED]: 320,
  [ActivityDetail.RESUMED]: 315,
  [ActivityDetail.REFACTORING]: 310,
};

export const ACTIVITY_TIERS: { tier: ActivityTier; from: number }[] = [
  { tier: ActivityTier.OUTCOME, from: 800 },
  { tier: ActivityTier.CHECK, from: 700 },
  { tier: ActivityTier.TRANSITION, from: 500 },
  { tier: ActivityTier.WORK, from: 250 },
  { tier: ActivityTier.PARTICIPATION, from: 100 },
  { tier: ActivityTier.CONTEXT, from: 1 },
];

export const ACTIVITY_ROLE_BONUS = 30;

export const ACTIVITY_CHAIN_BONUS = 5;

export const ACTIVITY_ROLE_FOCUS: Record<JobRole, ActivityRoleFocus> = {
  [JobRole.DEVELOPER]: { actions: [ActivityAction.CODE, ActivityAction.MERGED], states: [] },
  [JobRole.QA]: {
    actions: [
      ActivityAction.APPROVED,
      ActivityAction.RETURNED,
      ActivityAction.REVIEWED,
      ActivityAction.BUG_FOUND,
      ActivityAction.RELEASE_BLOCKED,
    ],
    states: [WorkflowState.TESTING, WorkflowState.QA_PASSED],
  },
  [JobRole.PROJECT_MANAGER]: {
    actions: [
      ActivityAction.CLOSED,
      ActivityAction.CREATED,
      ActivityAction.ESCALATED,
      ActivityAction.PLANNED,
      ActivityAction.MILESTONE_CLOSED,
    ],
    states: [WorkflowState.PLANNED],
  },
  [JobRole.SYSTEM_ANALYST]: {
    actions: [ActivityAction.REQUIREMENTS, ActivityAction.CREATED],
    states: [WorkflowState.ANALYSIS, WorkflowState.DESIGN, WorkflowState.NEEDS_INFO],
  },
  [JobRole.DEVOPS]: {
    actions: [ActivityAction.RELEASED],
    states: [WorkflowState.STAGING, WorkflowState.RELEASED, WorkflowState.READY_FOR_RELEASE],
  },
};
