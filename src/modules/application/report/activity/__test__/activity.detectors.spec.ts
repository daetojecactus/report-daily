import { describe, expect, it } from 'vitest';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import type { SourceFact } from 'src/modules/application/source/source.interface';
import { WorkflowState } from 'src/modules/application/trait/trait.enums';
import { JobRole } from 'src/modules/application/user/user.enums';
import { ActivityAction, ActivityDetail, ActivityRule } from '../activity.enums';
import type { ActivityLine } from '../activity.interface';
import {
  at,
  createDetectors,
  createIssue,
  createMergeRequest,
  detect,
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

type Place = 'issue' | 'own' | 'other';

const PLACES: Record<SourceActionKind, [Place, Partial<SourceFact>][] | ActivityRule> = {
  [SourceActionKind.OPENED]: [
    ['issue', {}],
    ['own', {}],
  ],
  [SourceActionKind.PUSHED]: [
    ['own', {}],
    ['other', {}],
  ],
  [SourceActionKind.COMMENTED]: [
    ['issue', {}],
    ['own', {}],
    ['other', {}],
  ],
  [SourceActionKind.CLOSED]: [
    ['issue', {}],
    ['own', {}],
    ['other', {}],
  ],
  [SourceActionKind.REOPENED]: [
    ['issue', {}],
    ['own', {}],
  ],
  [SourceActionKind.MERGED]: [
    ['own', {}],
    ['other', {}],
  ],
  [SourceActionKind.STATUS_SET]: [
    ['issue', { value: 'Done' }],
    ['issue', { value: 'Waiting for vendor' }],
  ],
  [SourceActionKind.LABEL_ADDED]: [
    ['issue', { value: 'status::review' }],
    ['issue', { value: 'team::web' }],
    ['own', { value: 'qa::returned' }],
  ],
  [SourceActionKind.LABEL_REMOVED]: [
    ['issue', { value: 'status::hold' }],
    ['own', { value: 'needs-rebase' }],
  ],
  [SourceActionKind.ASSIGNED]: [['issue', { users: [OTHER] }]],
  [SourceActionKind.UNASSIGNED]: [['issue', { users: [OTHER] }]],
  [SourceActionKind.REVIEW_REQUESTED]: [
    ['own', { users: [OTHER] }],
    ['other', { users: [ME] }],
  ],
  [SourceActionKind.REVIEW_REQUEST_REMOVED]: [['own', { users: [OTHER] }]],
  [SourceActionKind.APPROVED]: [['other', {}]],
  [SourceActionKind.UNAPPROVED]: [['other', {}]],
  [SourceActionKind.MARKED_READY]: [['own', {}]],
  [SourceActionKind.MARKED_DRAFT]: [['own', {}]],
  [SourceActionKind.DESCRIPTION_CHANGED]: [
    ['issue', {}],
    ['own', {}],
  ],
  [SourceActionKind.TITLE_CHANGED]: [
    ['issue', {}],
    ['own', {}],
  ],
  [SourceActionKind.THREADS_RESOLVED]: [
    ['own', {}],
    ['other', {}],
  ],
  [SourceActionKind.BRANCH_CREATED]: [['issue', { value: '12-login' }]],
  [SourceActionKind.DIFF_LINE_CHANGED]: [
    ['own', {}],
    ['other', {}],
  ],
  [SourceActionKind.REVIEW_SUBMITTED]: [
    ['own', {}],
    ['other', {}],
  ],
  [SourceActionKind.MILESTONE_SET]: [
    ['issue', { value: '17.5' }],
    ['own', { value: '17.5' }],
  ],
  [SourceActionKind.MILESTONE_REMOVED]: [
    ['issue', { value: '17.5' }],
    ['own', { value: '17.5' }],
  ],
  [SourceActionKind.ITERATION_SET]: [['issue', { value: '2026-11-03 – 2026-11-16' }]],
  [SourceActionKind.ITERATION_REMOVED]: [['issue', { value: '2026-11-03 – 2026-11-16' }]],
  [SourceActionKind.WEIGHT_SET]: [['issue', { value: '3' }]],
  [SourceActionKind.WEIGHT_REMOVED]: [['issue', { value: '3' }]],
  [SourceActionKind.COMMIT_MENTIONED]: [
    ['issue', { value: 'abc1234' }],
    ['own', { value: 'abc1234' }],
    ['other', { value: 'abc1234' }],
  ],
  [SourceActionKind.LINKED]: [
    ['issue', { value: 'related to' }],
    ['issue', { value: 'blocked by' }],
    ['issue', { value: 'parent' }],
    ['issue', { value: 'duplicate' }],
  ],
  [SourceActionKind.UNLINKED]: [['issue', {}]],
  [SourceActionKind.CHILD_ADDED]: [['issue', {}]],
  [SourceActionKind.MOVED_IN]: [['issue', { value: 'group/project#3' }]],
  [SourceActionKind.MOVED_OUT]: ActivityRule.MOVED_AWAY,
  [SourceActionKind.DUPLICATE_MARKED]: [['issue', {}]],
};

function placeFact(place: Place, item: SourceFact): ActivityLine {
  if (place === 'issue') {
    return issueLine(createIssue({ facts: [item] }));
  }
  const mergeRequest =
    place === 'own' ? createMergeRequest({ facts: [item] }) : othersMergeRequest({ facts: [item] });
  return { issue: null, pushes: [], mergeRequests: [mergeRequest] };
}

describe('ActivityDetectors', () => {
  describe('state changes', () => {
    it('weighs a state by the dictionary and returns work on changes requested', () => {
      const issue = createIssue({
        facts: [
          fact(SourceActionKind.LABEL_ADDED, at(10), { value: 'status::doing' }),
          fact(SourceActionKind.LABEL_ADDED, at(11), { value: 'status::review' }),
          fact(SourceActionKind.LABEL_ADDED, at(12), { value: 'status::qa passed' }),
          fact(SourceActionKind.LABEL_ADDED, at(13), { value: 'status::after review' }),
          fact(SourceActionKind.LABEL_ADDED, at(14), { value: 'qa::returned' }),
          fact(SourceActionKind.LABEL_ADDED, at(15), { value: 'priority::critical' }),
        ],
      });

      expect(summarize(detect(issueLine(issue)))).toEqual([
        {
          action: ActivityAction.STATE_SET,
          weight: 290,
          state: WorkflowState.IN_PROGRESS,
          details: [],
        },
        { action: ActivityAction.STATE_SET, weight: 550, state: WorkflowState.REVIEW, details: [] },
        {
          action: ActivityAction.STATE_SET,
          weight: 790,
          state: WorkflowState.QA_PASSED,
          details: [],
        },
        {
          action: ActivityAction.RETURNED,
          weight: 770,
          state: null,
          details: [ActivityDetail.AFTER_REVIEW],
        },
        {
          action: ActivityAction.RETURNED,
          weight: 770,
          state: null,
          details: [ActivityDetail.AFTER_QA],
        },
        { action: ActivityAction.ESCALATED, weight: 600, state: null, details: [] },
      ]);
    });

    it('marks ready for QA again after a return', () => {
      const ready = fact(SourceActionKind.LABEL_ADDED, at(12), { value: 'status::ready for qa' });
      const returned = (time: string) =>
        otherFact(SourceActionKind.LABEL_ADDED, time, { value: 'qa::returned' });
      const details = (issue: ReturnType<typeof createIssue>) =>
        summarize(detect(issueLine(issue))).find(
          (candidate) => candidate.state === WorkflowState.READY_FOR_QA,
        )?.details;

      expect(details(createIssue({ facts: [returned(at(10)), ready] }))).toEqual([
        ActivityDetail.AFTER_QA,
      ]);
      expect(
        details(
          createIssue({
            startOfDay: { ...createIssue().startOfDay, labels: ['qa::returned'] },
            facts: [ready],
          }),
        ),
      ).toEqual([ActivityDetail.AFTER_QA]);
      expect(details(createIssue({ facts: [ready, returned(at(14))] }))).toEqual([]);
    });

    it('returns the task to work when someone else moves it back', () => {
      const back = (labels: string[], assignees: string[], facts = [doing]) =>
        summarize(
          detect(
            issueLine(
              createIssue({
                assignees,
                startOfDay: { ...createIssue().startOfDay, labels },
                facts,
              }),
            ),
          ),
        );
      const doing = fact(SourceActionKind.LABEL_ADDED, at(10), { value: 'status::doing' });
      const review = fact(SourceActionKind.LABEL_ADDED, at(9), { value: 'status::review' });

      expect(back(['status::testing'], [OTHER])).toEqual([
        {
          action: ActivityAction.RETURNED,
          weight: 770,
          state: null,
          details: [ActivityDetail.AFTER_QA],
        },
      ]);
      expect(back([], [OTHER], [review, doing]).at(-1)).toEqual({
        action: ActivityAction.RETURNED,
        weight: 770,
        state: null,
        details: [ActivityDetail.AFTER_REVIEW],
      });
      expect(back(['status::testing'], [ME])).toEqual([
        {
          action: ActivityAction.STATE_SET,
          weight: 290,
          state: WorkflowState.IN_PROGRESS,
          details: [],
        },
      ]);
      expect(back(['status::todo'], [OTHER])[0].action).toBe(ActivityAction.STATE_SET);
    });

    it('blocks the release when it raises a bug in testing to critical', () => {
      const raise = fact(SourceActionKind.LABEL_ADDED, at(11), { value: 'priority::critical' });
      const action = (labels: string[]) =>
        summarize(detect(issueLine(createIssue({ labels, facts: [raise] }))))[0];

      expect(action(['type::bug', 'status::testing'])).toEqual({
        action: ActivityAction.RELEASE_BLOCKED,
        weight: 765,
        state: null,
        details: [],
      });
      expect(action(['status::testing']).action).toBe(ActivityAction.ESCALATED);
      expect(action(['type::bug']).action).toBe(ActivityAction.ESCALATED);
    });

    it('reads the Status field like a label', () => {
      const issue = createIssue({
        facts: [fact(SourceActionKind.STATUS_SET, at(11), { value: 'Done' })],
      });

      expect(summarize(detect(issueLine(issue)))).toEqual([
        { action: ActivityAction.STATE_SET, weight: 935, state: WorkflowState.DONE, details: [] },
      ]);
    });
  });

  describe('review', () => {
    it('approves after rework, takes a review and sends to review', () => {
      const other = othersMergeRequest({
        startOfDay: {
          ...createMergeRequest().startOfDay,
          labels: ['status::after review'],
        },
        facts: [
          fact(SourceActionKind.REVIEW_REQUESTED, at(9), { users: [ME] }),
          fact(SourceActionKind.APPROVED, at(15)),
        ],
      });
      const own = createMergeRequest({
        iid: 7,
        facts: [fact(SourceActionKind.REVIEW_REQUESTED, at(16), { users: [OTHER] })],
      });

      expect(summarize(detect({ issue: null, pushes: [], mergeRequests: [other, own] }))).toEqual([
        { action: ActivityAction.TOOK_REVIEW, weight: 290, state: null, details: [] },
        {
          action: ActivityAction.APPROVED,
          weight: 780,
          state: null,
          details: [ActivityDetail.AFTER_REWORK],
        },
        {
          action: ActivityAction.STATE_SET,
          weight: 550,
          state: WorkflowState.REVIEW,
          details: [ActivityDetail.REVIEW_REQUEST],
        },
      ]);
    });

    it('counts remarks in merge requests of others', () => {
      const comments = [10, 11, 12].map((hour) => fact(SourceActionKind.COMMENTED, at(hour)));

      expect(
        summarize(
          detect({
            issue: null,
            pushes: [],
            mergeRequests: [othersMergeRequest({ facts: comments })],
          }),
        ),
      ).toEqual([
        {
          action: ActivityAction.REVIEWED,
          weight: 760,
          state: null,
          details: [ActivityDetail.MANY],
        },
      ]);
      expect(
        summarize(
          detect({
            issue: null,
            pushes: [],
            mergeRequests: [othersMergeRequest({ facts: comments.slice(0, 1) })],
          }),
        )[0].weight,
      ).toBe(720);
    });
  });

  describe('review of others', () => {
    it('counts a submitted review and resolved threads in merge requests of others', () => {
      const mergeRequest = othersMergeRequest({
        facts: [
          fact(SourceActionKind.COMMENTED, at(10)),
          fact(SourceActionKind.REVIEW_SUBMITTED, at(10)),
          fact(SourceActionKind.THREADS_RESOLVED, at(15)),
        ],
      });

      const [reviewed] = detect({ issue: null, pushes: [], mergeRequests: [mergeRequest] });

      expect(reviewed).toMatchObject({
        action: ActivityAction.REVIEWED,
        weight: 720,
        details: [ActivityDetail.RESOLVED],
      });
      expect(reviewed.facts).toHaveLength(3);
    });
  });

  describe('discussion', () => {
    it('detects requirements, assignments, comments and a title edit', () => {
      const issue = createIssue({
        facts: [
          fact(SourceActionKind.DESCRIPTION_CHANGED, at(10)),
          fact(SourceActionKind.TITLE_CHANGED, at(11)),
          fact(SourceActionKind.ASSIGNED, at(12), { users: [OTHER] }),
          fact(SourceActionKind.COMMENTED, at(13)),
        ],
      });

      expect(summarize(detect(issueLine(issue), JobRole.SYSTEM_ANALYST))).toEqual([
        { action: ActivityAction.REQUIREMENTS, weight: 320, state: null, details: [] },
        { action: ActivityAction.ASSIGNED, weight: 200, state: null, details: [] },
        { action: ActivityAction.COMMENTED, weight: 100, state: null, details: [] },
        {
          action: ActivityAction.EDITED,
          weight: 150,
          state: null,
          details: [ActivityDetail.TITLE],
        },
      ]);
    });

    it('refines the requirements after a discussion in the issue', () => {
      const edit = fact(SourceActionKind.DESCRIPTION_CHANGED, at(10));
      const requirements = (issue: ReturnType<typeof createIssue>) =>
        summarize(detect(issueLine(issue), JobRole.SYSTEM_ANALYST))[0];

      expect(
        requirements(createIssue({ facts: [otherFact(SourceActionKind.COMMENTED, at(9)), edit] })),
      ).toMatchObject({
        action: ActivityAction.REQUIREMENTS,
        details: [ActivityDetail.AFTER_DISCUSSION],
      });
      expect(
        requirements(createIssue({ facts: [edit, otherFact(SourceActionKind.COMMENTED, at(11))] })),
      ).toMatchObject({ action: ActivityAction.REQUIREMENTS, details: [] });
    });

    it('assigns, reassigns in one step and unassigns', () => {
      const reassigned = createIssue({
        facts: [
          fact(SourceActionKind.UNASSIGNED, at(10), { users: [ME] }),
          fact(SourceActionKind.ASSIGNED, at(10), { users: [OTHER] }),
        ],
      });
      const unassigned = createIssue({
        facts: [fact(SourceActionKind.UNASSIGNED, at(10), { users: [OTHER] })],
      });

      expect(summarize(detect(issueLine(reassigned)))).toEqual([
        { action: ActivityAction.ASSIGNED, weight: 200, state: null, details: [] },
      ]);
      expect(summarize(detect(issueLine(unassigned)))).toEqual([
        {
          action: ActivityAction.ASSIGNED,
          weight: 200,
          state: null,
          details: [ActivityDetail.UNASSIGNED],
        },
      ]);
    });

    it('discusses in an own merge request when others answer and there is no code', () => {
      const mergeRequest = createMergeRequest({
        facts: [
          otherFact(SourceActionKind.COMMENTED, at(9)),
          fact(SourceActionKind.COMMENTED, at(10)),
        ],
      });

      expect(summarize(detect({ issue: null, pushes: [], mergeRequests: [mergeRequest] }))).toEqual(
        [
          {
            action: ActivityAction.DISCUSSED,
            weight: 200,
            state: null,
            details: [ActivityDetail.DIALOG],
          },
        ],
      );
    });
  });

  describe('edits', () => {
    it('keeps own changes of a task without an action of their own as edits', () => {
      const issue = createIssue({
        facts: [
          fact(SourceActionKind.TITLE_CHANGED, at(10)),
          fact(SourceActionKind.LABEL_ADDED, at(11), { value: 'team::web' }),
          fact(SourceActionKind.LABEL_ADDED, at(11, 30), { value: 'priority::high' }),
          fact(SourceActionKind.LABEL_REMOVED, at(12), { value: 'status::hold' }),
          fact(SourceActionKind.STATUS_SET, at(13), { value: 'Waiting for vendor' }),
        ],
      });

      expect(summarize(detect(issueLine(issue)))).toEqual(
        [ActivityDetail.TITLE, ActivityDetail.LABELS, ActivityDetail.STATUS].map((detail) => ({
          action: ActivityAction.EDITED,
          weight: 150,
          state: null,
          details: [detail],
        })),
      );
    });

    it('keeps the description, the draft and the reviewers of a merge request as edits', () => {
      const mergeRequest = createMergeRequest({
        facts: [
          fact(SourceActionKind.DESCRIPTION_CHANGED, at(10)),
          fact(SourceActionKind.MARKED_DRAFT, at(11)),
          fact(SourceActionKind.REVIEW_REQUEST_REMOVED, at(12), { users: [OTHER] }),
        ],
      });

      expect(summarize(detect({ issue: null, pushes: [], mergeRequests: [mergeRequest] }))).toEqual(
        [ActivityDetail.DESCRIPTION, ActivityDetail.DRAFT, ActivityDetail.REVIEWERS].map(
          (detail) => ({
            action: ActivityAction.EDITED,
            weight: 150,
            state: null,
            details: [detail],
          }),
        ),
      );
    });
  });

  describe('completeness', () => {
    const cases = Object.values(SourceActionKind).flatMap((kind) => {
      const places = PLACES[kind];
      return typeof places === 'string'
        ? []
        : places.map(([place, overrides]) => ({ kind, place, overrides }));
    });
    const rules = Object.values(SourceActionKind).flatMap((kind) => {
      const rule = PLACES[kind];
      return typeof rule === 'string' ? [{ kind, rule }] : [];
    });

    it.each(rules)('leaves $kind out by the rule $rule', ({ kind, rule }) => {
      const signals = toSignals(issueLine(createIssue({ facts: [fact(kind, at(10))] })));

      expect(signals.own).toEqual([]);
      expect(signals.dropped.map((item) => item.rule)).toEqual([rule]);
    });

    it.each(cases)('turns $kind on $place into an action', ({ kind, place, overrides }) => {
      const signals = toSignals(placeFact(place, fact(kind, at(10), overrides)));
      const candidates = createDetectors().detect(signals);

      expect(signals.own).toHaveLength(1);
      expect(
        candidates.some(
          (candidate) =>
            candidate.action !== ActivityAction.STATE_ONLY &&
            candidate.facts.includes(signals.own[0]),
        ),
      ).toBe(true);
    });

    it('leaves no own fact of a busy day without an action', () => {
      const mergeRequest = createMergeRequest({
        facts: [
          fact(SourceActionKind.OPENED, at(9)),
          fact(SourceActionKind.MARKED_DRAFT, at(9, 30)),
          otherFact(SourceActionKind.COMMENTED, at(10)),
          fact(SourceActionKind.COMMENTED, at(10, 30)),
          fact(SourceActionKind.REVIEW_SUBMITTED, at(10, 30)),
          fact(SourceActionKind.DIFF_LINE_CHANGED, at(11)),
          fact(SourceActionKind.THREADS_RESOLVED, at(11, 30)),
          fact(SourceActionKind.DESCRIPTION_CHANGED, at(12)),
          fact(SourceActionKind.MARKED_READY, at(13)),
          fact(SourceActionKind.REVIEW_REQUESTED, at(13), { users: [OTHER] }),
          fact(SourceActionKind.REVIEW_REQUEST_REMOVED, at(13), { users: ['dev.third'] }),
        ],
        events: [pushEvent(at(11))],
      });
      const issue = createIssue({
        facts: [
          fact(SourceActionKind.LABEL_REMOVED, at(14), { value: 'status::doing' }),
          fact(SourceActionKind.LABEL_ADDED, at(14), { value: 'status::review' }),
          fact(SourceActionKind.LABEL_ADDED, at(14, 10), { value: 'team::web' }),
          fact(SourceActionKind.ASSIGNED, at(15), { users: [OTHER] }),
          fact(SourceActionKind.UNASSIGNED, at(16), { users: ['dev.third'] }),
          fact(SourceActionKind.TITLE_CHANGED, at(17)),
          fact(SourceActionKind.COMMENTED, at(18)),
        ],
        mergeRequests: [mergeRequest],
      });

      const signals = toSignals(issueLine(issue));
      const covered = new Set(
        createDetectors()
          .detect(signals)
          .flatMap((item) => item.facts),
      );

      expect(signals.own).toHaveLength(14);
      expect(signals.own.filter((item) => !covered.has(item))).toEqual([]);
    });
  });

  it('always offers an honest line by the state of the task', () => {
    const candidates = detect(issueLine(createIssue({ labels: ['status::testing'] })));

    expect(candidates).toEqual([
      {
        action: ActivityAction.STATE_ONLY,
        weight: 50,
        time: 0,
        state: WorkflowState.TESTING,
        details: [],
        facts: [],
        parts: [],
      },
    ]);
  });
});
