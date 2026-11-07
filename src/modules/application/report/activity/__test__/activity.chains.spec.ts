import { describe, expect, it } from 'vitest';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import type { GroupedMergeRequest } from 'src/modules/application/source/source.interface';
import { WorkflowState } from 'src/modules/application/trait/trait.enums';
import { JobRole } from 'src/modules/application/user/user.enums';
import { ActivityChains } from '../activity.chains';
import { ActivityAction, ActivityDetail, ActivityTier } from '../activity.enums';
import type { ActivityCandidate, ActivityLine } from '../activity.interface';
import {
  at,
  choose,
  combine,
  createDetectors,
  createIssue,
  createMergeRequest,
  fact,
  issueLine,
  ME,
  OTHER,
  otherFact,
  othersMergeRequest,
  pushEvent,
  summarize,
  toSignals,
} from './activity.fixture';

function composites(candidates: ActivityCandidate[]) {
  return candidates
    .filter((candidate) => candidate.parts.length)
    .map(({ action, weight, state, details, parts }) => ({
      action,
      weight,
      state,
      details,
      parts: parts.map((part) => part.action),
    }));
}

function mainTier(line: ActivityLine, role = JobRole.DEVELOPER) {
  return choose(line, role).trace.ranked[0].tier;
}

function withPushes(titles: string[] = ['fix: the login']): GroupedMergeRequest {
  return createMergeRequest({ events: [pushEvent(at(11), titles)] });
}

describe('ActivityChains', () => {
  it('makes the same action set twice one action', () => {
    const mergeRequest = createMergeRequest({
      facts: [
        fact(SourceActionKind.MARKED_READY, at(15)),
        fact(SourceActionKind.REVIEW_REQUESTED, at(15), { users: [OTHER] }),
      ],
    });
    const issue = createIssue({
      facts: [fact(SourceActionKind.LABEL_ADDED, at(15, 1), { value: 'status::review' })],
      mergeRequests: [mergeRequest],
    });
    const approvals = createIssue({
      assignees: [OTHER],
      mergeRequests: [
        othersMergeRequest({ facts: [fact(SourceActionKind.APPROVED, at(11))] }),
        othersMergeRequest({ iid: 6, facts: [fact(SourceActionKind.APPROVED, at(12))] }),
      ],
    });

    const review = combine(issueLine(issue));

    expect(summarize(review)).toEqual([
      {
        action: ActivityAction.STATE_SET,
        weight: 550,
        state: WorkflowState.REVIEW,
        details: [ActivityDetail.REVIEW_REQUEST],
      },
    ]);
    expect(review[0].facts).toHaveLength(3);
    expect(summarize(combine(issueLine(approvals)))).toEqual([
      { action: ActivityAction.APPROVED, weight: 780, state: null, details: [] },
    ]);
  });

  it('reworks and sends to review or to QA', () => {
    const toReview = createIssue({
      facts: [fact(SourceActionKind.LABEL_ADDED, at(12), { value: 'status::review' })],
      mergeRequests: [withPushes(['test: cover the login'])],
    });
    const toQa = createIssue({
      facts: [fact(SourceActionKind.LABEL_ADDED, at(12), { value: 'status::ready for qa' })],
      mergeRequests: [withPushes()],
    });
    const sentBefore = createIssue({
      facts: [fact(SourceActionKind.LABEL_ADDED, at(9), { value: 'status::review' })],
      mergeRequests: [withPushes()],
    });

    expect(composites(combine(issueLine(toReview)))).toEqual([
      {
        action: ActivityAction.STATE_SET,
        weight: 555,
        state: WorkflowState.REVIEW,
        details: [ActivityDetail.WITH_CODE, ActivityDetail.TESTS],
        parts: [ActivityAction.CODE],
      },
    ]);
    expect(composites(combine(issueLine(toQa)))).toEqual([
      {
        action: ActivityAction.STATE_SET,
        weight: 565,
        state: WorkflowState.READY_FOR_QA,
        details: [ActivityDetail.WITH_CODE],
        parts: [ActivityAction.CODE],
      },
    ]);
    expect(mainTier(issueLine(toQa))).toBe(ActivityTier.TRANSITION);
    expect(composites(combine(issueLine(sentBefore)))).toEqual([]);
  });

  it('fixes and returns to QA after a return at the start or during the day', () => {
    const ready = fact(SourceActionKind.LABEL_ADDED, at(14), { value: 'status::ready for qa' });
    const during = createIssue({
      facts: [otherFact(SourceActionKind.LABEL_ADDED, at(10), { value: 'qa::returned' }), ready],
      mergeRequests: [createMergeRequest({ events: [pushEvent(at(12))] })],
    });
    const atStart = createIssue({
      startOfDay: { ...createIssue().startOfDay, labels: ['qa::returned'] },
      facts: [ready],
      mergeRequests: [createMergeRequest({ events: [pushEvent(at(12))] })],
    });

    for (const issue of [during, atStart]) {
      expect(composites(combine(issueLine(issue)))).toEqual([
        {
          action: ActivityAction.STATE_SET,
          weight: 565,
          state: WorkflowState.READY_FOR_QA,
          details: [ActivityDetail.AFTER_QA, ActivityDetail.WITH_CODE],
          parts: [ActivityAction.CODE],
        },
      ]);
    }
  });

  it('approves and merges a merge request of someone else', () => {
    const mergeRequest = othersMergeRequest({
      facts: [fact(SourceActionKind.APPROVED, at(14)), fact(SourceActionKind.MERGED, at(15))],
    });
    const separate = [
      othersMergeRequest({ facts: [fact(SourceActionKind.APPROVED, at(14))] }),
      othersMergeRequest({ iid: 6, facts: [fact(SourceActionKind.MERGED, at(15))] }),
    ];

    expect(composites(combine({ issue: null, push: null, mergeRequests: [mergeRequest] }))).toEqual(
      [
        {
          action: ActivityAction.MERGED_OTHER,
          weight: 905,
          state: null,
          details: [ActivityDetail.WITH_APPROVAL],
          parts: [ActivityAction.APPROVED],
        },
      ],
    );
    expect(mainTier({ issue: null, push: null, mergeRequests: [mergeRequest] })).toBe(
      ActivityTier.OUTCOME,
    );
    expect(composites(combine({ issue: null, push: null, mergeRequests: separate }))).toEqual([]);
  });

  it('tests and confirms the work of someone else', () => {
    const issue = createIssue({
      assignees: [OTHER],
      facts: [fact(SourceActionKind.LABEL_ADDED, at(12, 1), { value: 'status::qa passed' })],
      mergeRequests: [
        othersMergeRequest({
          facts: [
            fact(SourceActionKind.REVIEW_REQUESTED, at(10), { users: [ME] }),
            fact(SourceActionKind.APPROVED, at(12)),
          ],
        }),
      ],
    });

    const choice = choose(issueLine(issue), JobRole.QA);

    expect(choice.main).toMatchObject({
      action: ActivityAction.STATE_SET,
      weight: 795,
      state: WorkflowState.QA_PASSED,
      details: [ActivityDetail.WITH_APPROVAL, ActivityDetail.WITH_TESTING],
    });
    expect(choice.main.parts.map((part) => part.action)).toEqual([
      ActivityAction.APPROVED,
      ActivityAction.TOOK_REVIEW,
    ]);
    expect(choice.trace.ranked[0]).toMatchObject({ tier: ActivityTier.CHECK, weight: 825 });
    expect(choice.secondary).toEqual([]);
  });

  it('tests and returns the task with remarks', () => {
    const issue = createIssue({
      assignees: [OTHER],
      facts: [
        fact(SourceActionKind.LABEL_ADDED, at(9), { value: 'status::testing' }),
        fact(SourceActionKind.LABEL_ADDED, at(15), { value: 'status::after review' }),
      ],
      mergeRequests: [
        othersMergeRequest({
          facts: [10, 11, 12].map((hour) => fact(SourceActionKind.COMMENTED, at(hour))),
        }),
      ],
    });

    const choice = choose(issueLine(issue), JobRole.QA);

    expect(choice.main).toMatchObject({
      action: ActivityAction.RETURNED,
      weight: 775,
      details: [
        ActivityDetail.AFTER_REVIEW,
        ActivityDetail.WITH_REMARKS,
        ActivityDetail.WITH_TESTING,
      ],
    });
    expect(choice.main.parts.map((part) => part.action)).toEqual([
      ActivityAction.REVIEWED,
      ActivityAction.STATE_SET,
    ]);
    expect(choice.trace.ranked[0].tier).toBe(ActivityTier.CHECK);
  });

  it('refines the requirements and plans the task or hands it over to work', () => {
    const issue = (state: string, time: string) =>
      createIssue({
        facts: [
          fact(SourceActionKind.DESCRIPTION_CHANGED, at(10)),
          fact(SourceActionKind.LABEL_ADDED, time, { value: state }),
        ],
      });

    expect(
      composites(combine(issueLine(issue('status::todo', at(11))), JobRole.SYSTEM_ANALYST)),
    ).toEqual([
      {
        action: ActivityAction.REQUIREMENTS,
        weight: 325,
        state: WorkflowState.PLANNED,
        details: [ActivityDetail.WITH_STATE],
        parts: [ActivityAction.STATE_SET],
      },
    ]);
    expect(
      composites(combine(issueLine(issue('status::doing', at(11))), JobRole.SYSTEM_ANALYST))[0],
    ).toMatchObject({ state: WorkflowState.IN_PROGRESS });
    expect(mainTier(issueLine(issue('status::doing', at(11))), JobRole.SYSTEM_ANALYST)).toBe(
      ActivityTier.WORK,
    );
    expect(composites(combine(issueLine(issue('status::doing', at(9)))))).toEqual([]);
  });

  it('loses no fact when it combines the actions', () => {
    const issue = createIssue({
      facts: [
        fact(SourceActionKind.DESCRIPTION_CHANGED, at(9)),
        fact(SourceActionKind.LABEL_ADDED, at(9, 30), { value: 'status::doing' }),
        fact(SourceActionKind.LABEL_ADDED, at(13, 1), { value: 'status::review' }),
      ],
      mergeRequests: [
        createMergeRequest({
          facts: [
            fact(SourceActionKind.MARKED_READY, at(13)),
            fact(SourceActionKind.REVIEW_REQUESTED, at(13), { users: [OTHER] }),
            fact(SourceActionKind.COMMENTED, at(14)),
          ],
          events: [pushEvent(at(11))],
        }),
      ],
    });

    const signals = toSignals(issueLine(issue));
    const combined = new ActivityChains().combine(signals, createDetectors().detect(signals));
    const covered = new Set(combined.flatMap((candidate) => candidate.facts));

    expect(summarize(combined).map(({ action, state }) => [action, state])).toEqual([
      [ActivityAction.STATE_SET, WorkflowState.REVIEW],
      [ActivityAction.REQUIREMENTS, WorkflowState.IN_PROGRESS],
      [ActivityAction.COMMENTED, null],
    ]);
    expect(signals.own.filter((item) => !covered.has(item))).toEqual([]);
  });
});
