import { ActivityAction, ActivityRule } from '../types/activity.enums';

export const ACTIVITY_SUMMARY_ACTIONS = new Set<ActivityAction>([
  ActivityAction.PLANNED,
  ActivityAction.ESTIMATED,
  ActivityAction.MOVED,
]);

export const ACTIVITY_SUMMARY_MIN_LINES = 3;

export const ACTIVITY_EXCLUDING_RULES = new Set<ActivityRule>([
  ActivityRule.MOVED_AWAY,
  ActivityRule.RECIPROCAL_LINK,
  ActivityRule.IGNORED_NAME,
]);

export const ACTIVITY_MANY_COMMENTS = 3;
