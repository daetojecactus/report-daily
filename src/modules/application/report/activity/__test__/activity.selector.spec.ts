import { describe, expect, it } from 'vitest';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import { TRAIT_STATE_WEIGHTS } from 'src/modules/application/trait/constants/trait.constants';
import { WorkflowState } from 'src/modules/application/trait/trait.enums';
import { JobRole } from 'src/modules/application/user/user.enums';
import { ACTIVITY_CODE_WEIGHTS, ACTIVITY_WEIGHTS } from '../constants/activity.constants';
import { ActivityAction, ActivityReason, ActivityTier } from '../activity.enums';
import type { ActivityCandidate } from '../activity.interface';
import { ActivitySelector } from '../activity.selector';
import {
  at,
  choose,
  createIssue,
  createMergeRequest,
  fact,
  issueLine,
  OTHER,
  pushEvent,
  toSignals,
} from './activity.fixture';

function candidate(
  action: ActivityAction,
  weight: number,
  time = 0,
  state: WorkflowState | null = null,
): ActivityCandidate {
  return { action, weight, time, state, details: [], facts: [], parts: [] };
}

function select(candidates: ActivityCandidate[], role = JobRole.DEVELOPER) {
  return new ActivitySelector().select(
    toSignals({ issue: null, event: null, pushes: [], mergeRequests: [] }, role),
    candidates,
  );
}

function tierOf(weight: number) {
  return select([candidate(ActivityAction.EDITED, weight)]).trace.ranked[0].tier;
}

describe('ActivitySelector', () => {
  it('puts every weight of the scale into its tier', () => {
    expect(
      Object.fromEntries(
        Object.entries(ACTIVITY_WEIGHTS).map(([name, weight]) => [name, tierOf(weight)]),
      ),
    ).toEqual({
      MERGED: ActivityTier.OUTCOME,
      CLOSED: ActivityTier.OUTCOME,
      MERGED_OTHER: ActivityTier.OUTCOME,
      COMPLETED: ActivityTier.OUTCOME,
      REOPENED: ActivityTier.OUTCOME,
      RELEASED: ActivityTier.OUTCOME,
      MILESTONE_CLOSED: ActivityTier.OUTCOME,
      PASSED: ActivityTier.CHECK,
      APPROVED: ActivityTier.CHECK,
      RETURNED: ActivityTier.CHECK,
      RELEASE_BLOCKED: ActivityTier.CHECK,
      REVIEWED_MANY: ActivityTier.CHECK,
      BUG_FOUND: ActivityTier.CHECK,
      REVIEWED: ActivityTier.CHECK,
      UNAPPROVED: ActivityTier.CHECK,
      MERGE_SCHEDULED: ActivityTier.TRANSITION,
      ESCALATED: ActivityTier.TRANSITION,
      CODE: ActivityTier.WORK,
      REQUIREMENTS: ActivityTier.WORK,
      DECOMPOSED: ActivityTier.WORK,
      DOCUMENTED: ActivityTier.WORK,
      TOOK_REVIEW: ActivityTier.WORK,
      PLANNED: ActivityTier.WORK,
      TAGGED: ActivityTier.WORK,
      CREATED: ActivityTier.PARTICIPATION,
      MOVED: ActivityTier.PARTICIPATION,
      LINKED: ActivityTier.PARTICIPATION,
      DISCUSSED: ActivityTier.PARTICIPATION,
      ASSIGNED: ActivityTier.PARTICIPATION,
      HELPED: ActivityTier.PARTICIPATION,
      ESTIMATED: ActivityTier.PARTICIPATION,
      EDITED: ActivityTier.PARTICIPATION,
      DELETED: ActivityTier.PARTICIPATION,
      COMMENTED: ActivityTier.PARTICIPATION,
      STATE_ONLY: ActivityTier.CONTEXT,
    });
    expect(
      Object.fromEntries(
        Object.values(WorkflowState).map((state) => [state, tierOf(TRAIT_STATE_WEIGHTS[state])]),
      ),
    ).toEqual({
      [WorkflowState.DONE]: ActivityTier.OUTCOME,
      [WorkflowState.RELEASED]: ActivityTier.OUTCOME,
      [WorkflowState.CANCELLED]: ActivityTier.OUTCOME,
      [WorkflowState.STAGING]: ActivityTier.OUTCOME,
      [WorkflowState.BLOCKED]: ActivityTier.OUTCOME,
      [WorkflowState.QA_PASSED]: ActivityTier.CHECK,
      [WorkflowState.TESTING]: ActivityTier.CHECK,
      [WorkflowState.CHANGES_REQUESTED]: ActivityTier.CHECK,
      [WorkflowState.READY_FOR_RELEASE]: ActivityTier.TRANSITION,
      [WorkflowState.READY_FOR_QA]: ActivityTier.TRANSITION,
      [WorkflowState.REVIEW]: ActivityTier.TRANSITION,
      [WorkflowState.HANDOFF]: ActivityTier.TRANSITION,
      [WorkflowState.NEEDS_INFO]: ActivityTier.TRANSITION,
      [WorkflowState.ANALYSIS]: ActivityTier.WORK,
      [WorkflowState.DESIGN]: ActivityTier.WORK,
      [WorkflowState.IN_PROGRESS]: ActivityTier.WORK,
      [WorkflowState.PLANNED]: ActivityTier.WORK,
      [WorkflowState.BACKLOG]: ActivityTier.WORK,
    });
    expect(
      Object.values(ACTIVITY_CODE_WEIGHTS).every(
        (weight) => weight !== undefined && tierOf(weight) === ActivityTier.WORK,
      ),
    ).toBe(true);
  });

  it('chooses the higher tier whatever the role bonus', () => {
    const qa = select(
      [
        candidate(ActivityAction.STATE_SET, 790, 20, WorkflowState.QA_PASSED),
        candidate(ActivityAction.REOPENED, 800, 10),
      ],
      JobRole.QA,
    );

    expect(qa.main.action).toBe(ActivityAction.REOPENED);
    expect(qa.trace.ranked.map(({ tier, weight }) => [tier, weight])).toEqual([
      [ActivityTier.OUTCOME, 800],
      [ActivityTier.CHECK, 820],
    ]);
    expect(qa.trace.reason).toBe(ActivityReason.TIER);
  });

  it('gives the own actions of the role a bonus inside a tier', () => {
    const work = [
      candidate(ActivityAction.CODE, 300, 10),
      candidate(ActivityAction.REQUIREMENTS, 320, 5),
    ];
    const release = [
      candidate(ActivityAction.CLOSED, 940, 10),
      candidate(ActivityAction.STATE_SET, 920, 5, WorkflowState.STAGING),
    ];

    expect(select(work, JobRole.DEVELOPER).main.action).toBe(ActivityAction.CODE);
    expect(select(work, JobRole.SYSTEM_ANALYST).main.action).toBe(ActivityAction.REQUIREMENTS);
    expect(select(release, JobRole.DEVELOPER).main.action).toBe(ActivityAction.CLOSED);
    const devops = select(release, JobRole.DEVOPS);
    expect(devops.main).toMatchObject({
      action: ActivityAction.STATE_SET,
      state: WorkflowState.STAGING,
    });
    expect(devops.trace.reason).toBe(ActivityReason.WEIGHT);
  });

  it('takes the later action when the weights are equal', () => {
    const choice = select([
      candidate(ActivityAction.EDITED, 150, 10),
      candidate(ActivityAction.EDITED, 150, 20),
    ]);

    expect(choice.main.time).toBe(20);
    expect(choice.trace.reason).toBe(ActivityReason.TIME);
  });

  it('ends the day with the heavier state of the task', () => {
    const issue = createIssue({
      facts: [
        fact(SourceActionKind.LABEL_ADDED, at(10), { value: 'status::review' }),
        fact(SourceActionKind.LABEL_ADDED, at(12), { value: 'status::ready for qa' }),
      ],
    });

    expect(choose(issueLine(issue)).main).toMatchObject({
      action: ActivityAction.STATE_SET,
      state: WorkflowState.READY_FOR_QA,
    });
  });

  it('keeps the honest state line only when nothing else happened', () => {
    const quiet = choose(issueLine(createIssue({ labels: ['status::testing'] })));
    const commented = choose(
      issueLine(
        createIssue({
          labels: ['status::testing'],
          facts: [fact(SourceActionKind.COMMENTED, at(10))],
        }),
      ),
    );

    expect(quiet.main).toMatchObject({
      action: ActivityAction.STATE_ONLY,
      state: WorkflowState.TESTING,
    });
    expect(quiet.secondary).toEqual([]);
    expect(quiet.trace.reason).toBe(ActivityReason.ONLY);
    expect(commented.main.action).toBe(ActivityAction.COMMENTED);
    expect(commented.secondary).toEqual([]);
    expect(commented.trace.reason).toBe(ActivityReason.ONLY);
  });

  it('explains the choice with every candidate, its tier and its weight', () => {
    const mergeRequest = createMergeRequest({
      facts: [
        fact(SourceActionKind.REVIEW_REQUESTED, at(9), { users: [OTHER] }),
        fact(SourceActionKind.COMMENTED, at(10)),
      ],
      events: [pushEvent(at(15))],
    });

    const choice = choose({ issue: null, event: null, pushes: [], mergeRequests: [mergeRequest] });

    expect(
      choice.trace.ranked.map(({ candidate: item, tier, weight }) => [item.action, tier, weight]),
    ).toEqual([
      [ActivityAction.STATE_SET, ActivityTier.TRANSITION, 550],
      [ActivityAction.CODE, ActivityTier.WORK, 330],
      [ActivityAction.COMMENTED, ActivityTier.PARTICIPATION, 100],
      [ActivityAction.STATE_ONLY, ActivityTier.CONTEXT, 50],
    ]);
    expect(choice.trace.reason).toBe(ActivityReason.TIER);
    expect(choice.secondary.map((item) => item.action)).toEqual([
      ActivityAction.CODE,
      ActivityAction.COMMENTED,
    ]);
  });
});
