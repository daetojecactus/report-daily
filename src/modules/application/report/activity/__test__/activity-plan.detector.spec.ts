import { describe, expect, it } from 'vitest';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import type { GroupedIssue, SourceFact } from 'src/modules/application/source/source.interface';
import { WorkflowState } from 'src/modules/application/trait/trait.enums';
import { JobRole } from 'src/modules/application/user/user.enums';
import { ActivityAction, ActivityDetail, ActivityRule } from '../activity.enums';
import {
  at,
  choose,
  combine,
  createIssue,
  createMergeRequest,
  detect,
  fact,
  issueLine,
  summarize,
  toSignals,
} from './activity.fixture';

const SPRINT = '2026-08-03 – 2026-08-16';

function planned(facts: SourceFact[], overrides: Partial<GroupedIssue> = {}) {
  return summarize(detect(issueLine(createIssue({ facts, ...overrides }))));
}

describe('ActivityPlanDetector', () => {
  it('puts a task into an iteration and plans it into a milestone', () => {
    expect(planned([fact(SourceActionKind.ITERATION_SET, at(10), { value: SPRINT })])).toEqual([
      {
        action: ActivityAction.PLANNED,
        weight: 285,
        state: null,
        details: [ActivityDetail.ITERATION],
      },
    ]);
    expect(
      planned([
        fact(SourceActionKind.ITERATION_SET, at(10), { value: SPRINT }),
        fact(SourceActionKind.MILESTONE_SET, at(10, 1), { value: '17.5' }),
      ])[0].details,
    ).toEqual([ActivityDetail.ITERATION, ActivityDetail.MILESTONE]);
  });

  it('moves a task from the iteration or the milestone it had at the start of the day', () => {
    const start = { ...createIssue().startOfDay, iteration: 'sprint 2', milestone: '17.4' };

    expect(
      planned([fact(SourceActionKind.ITERATION_SET, at(10), { value: SPRINT })], {
        startOfDay: start,
      })[0].details,
    ).toEqual([ActivityDetail.ITERATION, ActivityDetail.MOVED]);
    expect(
      planned([fact(SourceActionKind.MILESTONE_SET, at(10), { value: '17.5' })], {
        startOfDay: start,
      })[0].details,
    ).toEqual([ActivityDetail.MILESTONE, ActivityDetail.MOVED]);
  });

  it('plans a merge request into a milestone by the milestone of the merge request', () => {
    const mergeRequest = createMergeRequest({
      startOfDay: { ...createMergeRequest().startOfDay, milestone: '17.4' },
      facts: [fact(SourceActionKind.MILESTONE_SET, at(10), { value: '17.5' })],
    });

    expect(
      summarize(detect(issueLine(createIssue({ mergeRequests: [mergeRequest] }))))[0].details,
    ).toEqual([ActivityDetail.MILESTONE, ActivityDetail.MOVED]);
  });

  it('takes a removal without a replacement for an edit', () => {
    expect(
      planned([
        fact(SourceActionKind.ITERATION_REMOVED, at(10), { value: SPRINT }),
        fact(SourceActionKind.MILESTONE_REMOVED, at(11), { value: '17.5' }),
      ]).map(({ action, details }) => [action, details]),
    ).toEqual([
      [ActivityAction.EDITED, [ActivityDetail.ITERATION]],
      [ActivityAction.EDITED, [ActivityDetail.MILESTONE]],
    ]);
  });

  it('takes a plan right after creating the task for part of the creation', () => {
    const signals = toSignals(
      issueLine(
        createIssue({
          facts: [
            fact(SourceActionKind.OPENED, at(10)),
            fact(SourceActionKind.ITERATION_SET, at(10, 2), { value: SPRINT }),
          ],
        }),
      ),
    );

    expect(signals.dropped.map(({ fact: item, rule }) => [item.kind, rule])).toEqual([
      [SourceActionKind.ITERATION_SET, ActivityRule.SETUP],
    ]);
  });

  it('counts no plan undone within two minutes', () => {
    expect(
      planned([
        fact(SourceActionKind.ITERATION_SET, at(10), { value: SPRINT }),
        fact(SourceActionKind.ITERATION_REMOVED, at(10, 1), { value: SPRINT }),
      ]),
    ).toEqual([]);
  });

  it('gives a project manager the role bonus for planning', () => {
    const line = issueLine(
      createIssue({ facts: [fact(SourceActionKind.ITERATION_SET, at(10), { value: SPRINT })] }),
    );

    expect(choose(line, JobRole.PROJECT_MANAGER).trace.ranked[0].weight).toBe(315);
    expect(choose(line).trace.ranked[0].weight).toBe(285);
  });

  it('joins planning with the state Planned and with refined requirements', () => {
    const combined = (facts: SourceFact[]) =>
      summarize(combine(issueLine(createIssue({ facts })))).map(({ action, state, details }) => [
        action,
        state,
        details,
      ]);
    const sprint = fact(SourceActionKind.ITERATION_SET, at(11), { value: SPRINT });

    expect(
      combined([
        sprint,
        fact(SourceActionKind.LABEL_ADDED, at(11), { value: 'status::sprint backlog' }),
      ]),
    ).toEqual([[ActivityAction.PLANNED, null, [ActivityDetail.ITERATION]]]);
    expect(combined([fact(SourceActionKind.DESCRIPTION_CHANGED, at(10)), sprint])).toEqual([
      [ActivityAction.REQUIREMENTS, WorkflowState.PLANNED, [ActivityDetail.WITH_STATE]],
    ]);
  });
});
