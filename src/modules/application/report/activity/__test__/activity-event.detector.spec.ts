import { describe, expect, it } from 'vitest';
import {
  SourceEventAction,
  SourceTargetType,
} from 'src/modules/application/source/types/source.enums';
import type { CleanEvent } from 'src/modules/application/source/types/source.interface';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { ActivityAction, ActivityDetail } from '../types/activity.enums';
import type { ActivityLine } from '../types/activity.interface';
import { at, choose, detect, summarize } from './activity.fixture';

function event(actionName: SourceEventAction, time = at(10)): CleanEvent {
  return {
    id: 1,
    projectId: 1,
    actionName,
    targetType: null,
    targetTitle: 'Title',
    createdAt: time,
  };
}

function line(targetType: SourceTargetType, events: CleanEvent[]): ActivityLine {
  return {
    issue: null,
    mergeRequests: [],
    pushes: [],
    event: { projectId: 1, targetType, title: 'Runbook', events },
  };
}

function actions(targetType: SourceTargetType, events: CleanEvent[]) {
  return summarize(detect(line(targetType, events))).map(({ action, weight, details }) => [
    action,
    weight,
    details,
  ]);
}

describe('ActivityEventDetector', () => {
  it('documents by creating and updating a wiki page and deletes one', () => {
    expect(
      actions(SourceTargetType.WIKI_PAGE, [
        event(SourceEventAction.CREATED),
        event(SourceEventAction.UPDATED, at(11)),
      ]),
    ).toEqual([[ActivityAction.DOCUMENTED, 300, [ActivityDetail.NEW_PAGE]]]);
    expect(actions(SourceTargetType.WIKI_PAGE, [event(SourceEventAction.DESTROYED)])).toEqual([
      [ActivityAction.DELETED, 120, [ActivityDetail.WIKI]],
    ]);
  });

  it('plans, closes, reopens and deletes a milestone', () => {
    expect(actions(SourceTargetType.MILESTONE, [event(SourceEventAction.OPENED)])).toEqual([
      [ActivityAction.PLANNED, 285, [ActivityDetail.NEW_MILESTONE]],
    ]);
    expect(actions(SourceTargetType.MILESTONE, [event(SourceEventAction.CLOSED)])).toEqual([
      [ActivityAction.MILESTONE_CLOSED, 920, []],
    ]);
    expect(actions(SourceTargetType.MILESTONE, [event(SourceEventAction.REOPENED)])).toEqual([
      [ActivityAction.REOPENED, 880, [ActivityDetail.MILESTONE]],
    ]);
    expect(actions(SourceTargetType.MILESTONE, [event(SourceEventAction.DESTROYED)])).toEqual([
      [ActivityAction.DELETED, 120, [ActivityDetail.MILESTONE]],
    ]);
  });

  it('gives a project manager the role bonus for milestones', () => {
    const closed = line(SourceTargetType.MILESTONE, [event(SourceEventAction.CLOSED)]);

    expect(choose(closed, JobRole.PROJECT_MANAGER).trace.ranked[0].weight).toBe(950);
    expect(choose(closed).trace.ranked[0].weight).toBe(920);
  });
});
