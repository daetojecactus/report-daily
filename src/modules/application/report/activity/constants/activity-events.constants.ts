import {
  SourceEventAction,
  SourceTargetType,
  WorkItemType,
} from 'src/modules/application/source/types/source.enums';
import { TaskKind } from 'src/modules/application/trait/types/trait.enums';
import { ActivityAction, ActivityDetail } from '../types/activity.enums';
import { ACTIVITY_WEIGHTS } from './activity-weights.constants';

export const ACTIVITY_TARGET_ACTIONS: Record<
  SourceTargetType,
  Map<string, { action: ActivityAction; weight: number; details: ActivityDetail[] }>
> = {
  [SourceTargetType.WIKI_PAGE]: new Map([
    [
      SourceEventAction.CREATED,
      {
        action: ActivityAction.DOCUMENTED,
        weight: ACTIVITY_WEIGHTS.DOCUMENTED,
        details: [ActivityDetail.NEW_PAGE],
      },
    ],
    [
      SourceEventAction.UPDATED,
      { action: ActivityAction.DOCUMENTED, weight: ACTIVITY_WEIGHTS.DOCUMENTED, details: [] },
    ],
    [
      SourceEventAction.DESTROYED,
      {
        action: ActivityAction.DELETED,
        weight: ACTIVITY_WEIGHTS.DELETED,
        details: [ActivityDetail.WIKI],
      },
    ],
  ]),
  [SourceTargetType.MILESTONE]: new Map([
    [
      SourceEventAction.OPENED,
      {
        action: ActivityAction.PLANNED,
        weight: ACTIVITY_WEIGHTS.PLANNED,
        details: [ActivityDetail.NEW_MILESTONE],
      },
    ],
    [
      SourceEventAction.CLOSED,
      {
        action: ActivityAction.MILESTONE_CLOSED,
        weight: ACTIVITY_WEIGHTS.MILESTONE_CLOSED,
        details: [],
      },
    ],
    [
      SourceEventAction.REOPENED,
      {
        action: ActivityAction.REOPENED,
        weight: ACTIVITY_WEIGHTS.REOPENED,
        details: [ActivityDetail.MILESTONE],
      },
    ],
    [
      SourceEventAction.DESTROYED,
      {
        action: ActivityAction.DELETED,
        weight: ACTIVITY_WEIGHTS.DELETED,
        details: [ActivityDetail.MILESTONE],
      },
    ],
  ]),
};

export const ACTIVITY_WORK_ITEM_KINDS = new Map<WorkItemType, TaskKind>([
  [WorkItemType.INCIDENT, TaskKind.INCIDENT],
  [WorkItemType.REQUIREMENT, TaskKind.REQUIREMENTS],
  [WorkItemType.TEST_CASE, TaskKind.TEST_AUTOMATION],
  [WorkItemType.EPIC, TaskKind.EPIC],
]);

export const ACTIVITY_BRANCH_PUSH_ACTION: string = SourceEventAction.PUSHED_NEW;

export const ACTIVITY_DELETE_ACTION: string = SourceEventAction.DELETED;

export const ACTIVITY_PUSH_ACTIONS = new Set<string>([
  SourceEventAction.PUSHED_TO,
  SourceEventAction.PUSHED_NEW,
]);
