import { describe, expect, it } from 'vitest';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import { TaskFlag, TaskKind, WorkflowState } from 'src/modules/application/trait/trait.enums';
import { ActivityRule, EngagementLevel } from '../activity.enums';
import {
  at,
  createIssue,
  createMergeRequest,
  fact,
  issueLine,
  ME,
  OTHER,
  otherFact,
  othersMergeRequest,
  pushEvent,
  toSignals,
} from './activity.fixture';

function ownKinds(line: Parameters<typeof toSignals>[0]) {
  return toSignals(line).own.map((item) => item.kind);
}

describe('ActivitySignals', () => {
  describe('accuracy rules', () => {
    it('drops an action undone by the same person within two minutes', () => {
      const issue = createIssue({
        facts: [
          fact(SourceActionKind.LABEL_ADDED, at(17, 23, 39), { value: 'status::qa passed' }),
          fact(SourceActionKind.LABEL_REMOVED, at(17, 23, 42), { value: 'status::qa passed' }),
          fact(SourceActionKind.LABEL_ADDED, at(18, 23), { value: 'status::after review' }),
        ],
      });

      const signals = toSignals({ issue, mergeRequests: [] });

      expect(signals.changes.map((change) => change.state)).toEqual([
        WorkflowState.CHANGES_REQUESTED,
      ]);
    });

    it('keeps an action changed back after more than two minutes', () => {
      const issue = createIssue({
        facts: [
          fact(SourceActionKind.LABEL_ADDED, at(10), { value: 'status::review' }),
          fact(SourceActionKind.LABEL_REMOVED, at(10, 5), { value: 'status::review' }),
        ],
      });

      expect(toSignals({ issue, mergeRequests: [] }).changes).toHaveLength(1);
    });

    it('makes the setup and the editing of a new task part of creating it', () => {
      const issue = createIssue({
        facts: [
          fact(SourceActionKind.OPENED, at(10)),
          fact(SourceActionKind.LABEL_ADDED, at(10, 1), { value: 'status::doing' }),
          fact(SourceActionKind.ASSIGNED, at(10, 1), { users: [OTHER] }),
          fact(SourceActionKind.STATUS_SET, at(10, 2), { value: 'In progress' }),
          fact(SourceActionKind.DESCRIPTION_CHANGED, at(15)),
          fact(SourceActionKind.LABEL_ADDED, at(16), { value: 'status::review' }),
        ],
      });

      const signals = toSignals({ issue, mergeRequests: [] });

      expect(signals.own.map((item) => item.kind)).toEqual([
        SourceActionKind.OPENED,
        SourceActionKind.LABEL_ADDED,
      ]);
      expect(signals.createdToday).toBe(true);
    });

    it('ignores the Status that GitLab sets on opening and closing', () => {
      const issue = createIssue({
        facts: [
          fact(SourceActionKind.CLOSED, at(17)),
          fact(SourceActionKind.STATUS_SET, at(17, 0, 2), { value: 'Done' }),
        ],
      });

      expect(ownKinds({ issue, mergeRequests: [] })).toEqual([SourceActionKind.CLOSED]);
    });

    it('makes closing an issue on merge part of the merge', () => {
      const mergeRequest = createMergeRequest({
        author: OTHER,
        assignees: [OTHER],
        facts: [fact(SourceActionKind.MERGED, at(16))],
      });
      const issue = createIssue({
        assignees: [OTHER],
        facts: [fact(SourceActionKind.CLOSED, at(16, 0, 30))],
        mergeRequests: [mergeRequest],
      });

      expect(ownKinds({ issue, mergeRequests: [mergeRequest] })).toEqual([SourceActionKind.MERGED]);
    });

    it('does not count approving one own merge request', () => {
      const own = createMergeRequest({ facts: [fact(SourceActionKind.APPROVED, at(11))] });
      const other = createMergeRequest({
        iid: 6,
        author: OTHER,
        assignees: [OTHER],
        facts: [fact(SourceActionKind.APPROVED, at(12))],
      });

      const signals = toSignals({ issue: null, mergeRequests: [own, other] });

      expect(signals.own.map((item) => [item.kind, item.mergeRequestIid])).toEqual([
        [SourceActionKind.APPROVED, 6],
      ]);
      expect(signals.ownMergeRequests).toEqual([5]);
    });

    it('drops removing oneself from the reviewers', () => {
      const mergeRequest = createMergeRequest({
        author: OTHER,
        assignees: [OTHER],
        facts: [
          fact(SourceActionKind.REVIEW_REQUESTED, at(10), { users: [ME] }),
          fact(SourceActionKind.REVIEW_REQUEST_REMOVED, at(15), { users: [ME] }),
        ],
      });

      expect(ownKinds({ issue: null, mergeRequests: [mergeRequest] })).toEqual([
        SourceActionKind.REVIEW_REQUESTED,
      ]);
    });

    it('makes a replacement of a label, an assignee or a reviewer one change', () => {
      const mergeRequest = createMergeRequest({
        facts: [
          fact(SourceActionKind.REVIEW_REQUEST_REMOVED, at(11), { users: [OTHER] }),
          fact(SourceActionKind.REVIEW_REQUESTED, at(11), { users: ['dev.third'] }),
        ],
      });
      const issue = createIssue({
        facts: [
          fact(SourceActionKind.LABEL_REMOVED, at(10), { value: 'status::doing' }),
          fact(SourceActionKind.LABEL_ADDED, at(10), { value: 'status::review' }),
          fact(SourceActionKind.UNASSIGNED, at(12), { users: [ME] }),
          fact(SourceActionKind.ASSIGNED, at(12, 0, 1), { users: [OTHER] }),
        ],
        mergeRequests: [mergeRequest],
      });

      expect(ownKinds({ issue, mergeRequests: [mergeRequest] })).toEqual([
        SourceActionKind.LABEL_ADDED,
        SourceActionKind.REVIEW_REQUESTED,
        SourceActionKind.ASSIGNED,
      ]);
    });

    it('counts a label set on the issue and its merge request once', () => {
      const mergeRequest = createMergeRequest({
        facts: [fact(SourceActionKind.LABEL_ADDED, at(12, 0, 5), { value: 'status::qa passed' })],
      });
      const issue = createIssue({
        facts: [fact(SourceActionKind.LABEL_ADDED, at(12), { value: 'status::qa passed' })],
        mergeRequests: [mergeRequest],
      });

      const signals = toSignals({ issue, mergeRequests: [mergeRequest] });

      expect(signals.changes).toHaveLength(1);
      expect(signals.changes[0].fact.mergeRequestIid).toBeNull();
    });

    it('names the rule that dropped each fact', () => {
      const mergeRequest = createMergeRequest({
        facts: [
          fact(SourceActionKind.OPENED, at(9)),
          fact(SourceActionKind.LABEL_ADDED, at(9, 1), { value: 'status::doing' }),
          fact(SourceActionKind.APPROVED, at(12)),
          fact(SourceActionKind.REVIEW_REQUEST_REMOVED, at(13), { users: [ME] }),
          fact(SourceActionKind.LABEL_ADDED, at(14, 0, 5), { value: 'status::qa passed' }),
          fact(SourceActionKind.MERGED, at(16, 59)),
        ],
      });
      const issue = createIssue({
        facts: [
          fact(SourceActionKind.LABEL_ADDED, at(10), { value: 'status::testing' }),
          fact(SourceActionKind.LABEL_REMOVED, at(10, 0, 3), { value: 'status::testing' }),
          fact(SourceActionKind.LABEL_REMOVED, at(11), { value: 'status::doing' }),
          fact(SourceActionKind.LABEL_ADDED, at(11), { value: 'status::review' }),
          fact(SourceActionKind.LABEL_ADDED, at(14), { value: 'status::qa passed' }),
          fact(SourceActionKind.CLOSED, at(17)),
          fact(SourceActionKind.STATUS_SET, at(17, 0, 2), { value: 'Done' }),
        ],
        mergeRequests: [mergeRequest],
      });

      expect(
        toSignals(issueLine(issue)).dropped.map(({ fact: item, rule }) => [item.kind, rule]),
      ).toEqual([
        [SourceActionKind.LABEL_ADDED, ActivityRule.SETUP],
        [SourceActionKind.LABEL_ADDED, ActivityRule.UNDONE],
        [SourceActionKind.LABEL_REMOVED, ActivityRule.UNDONE],
        [SourceActionKind.LABEL_REMOVED, ActivityRule.REPLACED],
        [SourceActionKind.APPROVED, ActivityRule.SELF_APPROVAL],
        [SourceActionKind.REVIEW_REQUEST_REMOVED, ActivityRule.SELF_REVIEW_REMOVAL],
        [SourceActionKind.LABEL_ADDED, ActivityRule.REPEATED],
        [SourceActionKind.CLOSED, ActivityRule.CLOSED_BY_MERGE],
        [SourceActionKind.STATUS_SET, ActivityRule.AUTOMATIC_STATUS],
      ]);
    });
  });

  describe('state and traits', () => {
    it('reads traits from the issue and all its merge requests at the start and the end', () => {
      const mergeRequest = createMergeRequest({
        labels: ['status::after review'],
        startOfDay: {
          ...createMergeRequest().startOfDay,
          labels: ['status::ready for qa', 'qa::returned'],
        },
      });
      const issue = createIssue({
        labels: ['type::bug'],
        status: 'Done',
        startOfDay: { ...createIssue().startOfDay, status: 'In progress' },
        mergeRequests: [mergeRequest],
      });

      const signals = toSignals({ issue, mergeRequests: [mergeRequest] });

      expect(signals.kind).toBe(TaskKind.BUG);
      expect(signals.startStates).toEqual([WorkflowState.IN_PROGRESS, WorkflowState.READY_FOR_QA]);
      expect(signals.endStates).toEqual([WorkflowState.CHANGES_REQUESTED, WorkflowState.DONE]);
      expect(signals.startFlags).toEqual([TaskFlag.RETURNED_FROM_QA]);
    });

    it('collects flags removed by anyone and the pushes of the day', () => {
      const mergeRequest = createMergeRequest({
        facts: [otherFact(SourceActionKind.LABEL_REMOVED, at(9), { value: 'needs-rebase' })],
        events: [pushEvent(at(11), ['fix: a', 'test: b'])],
      });

      const signals = toSignals({ issue: null, mergeRequests: [mergeRequest] });

      expect(signals.removedFlags).toEqual([TaskFlag.NEEDS_REBASE]);
      expect(signals.pushes).toEqual([
        {
          time: Date.parse(at(11)),
          mergeRequestIid: 5,
          commitCount: 2,
          commitTitles: ['fix: a', 'test: b'],
        },
      ]);
    });

    it('knows the state a move to work came from', () => {
      const doing = fact(SourceActionKind.LABEL_ADDED, at(10), { value: 'status::doing' });
      const from = (issue: ReturnType<typeof createIssue>) =>
        toSignals(issueLine(issue)).changes.at(-1)?.returnedFrom;

      expect(
        from(
          createIssue({
            startOfDay: { ...createIssue().startOfDay, labels: ['status::testing'] },
            facts: [doing],
          }),
        ),
      ).toBe(WorkflowState.TESTING);
      expect(
        from(
          createIssue({
            facts: [
              otherFact(SourceActionKind.LABEL_ADDED, at(9), { value: 'status::review' }),
              doing,
            ],
          }),
        ),
      ).toBe(WorkflowState.REVIEW);
      expect(
        from(
          createIssue({
            startOfDay: { ...createIssue().startOfDay, labels: ['status::todo'] },
            facts: [doing],
          }),
        ),
      ).toBeNull();
    });

    it('counts a move back to work by someone who is not an assignee as a return', () => {
      const moved = otherFact(SourceActionKind.LABEL_ADDED, at(10), { value: 'status::doing' });
      const testing = { ...createIssue().startOfDay, labels: ['status::testing'] };
      const returnedAt = (assignees: string[]) =>
        toSignals(issueLine(createIssue({ assignees, startOfDay: testing, facts: [moved] })))
          .returnedAt;

      expect(returnedAt([ME])).toBe(Date.parse(at(10)));
      expect(returnedAt([ME, OTHER])).toBeNull();
    });

    it('knows when the task was returned to work', () => {
      const returnedAt = (issue: ReturnType<typeof createIssue>) =>
        toSignals(issueLine(issue)).returnedAt;
      const label = { value: 'qa::returned' };

      expect(
        returnedAt(
          createIssue({
            startOfDay: { ...createIssue().startOfDay, labels: ['status::after review'] },
          }),
        ),
      ).toBe(0);
      expect(
        returnedAt(
          createIssue({ facts: [otherFact(SourceActionKind.LABEL_ADDED, at(10), label)] }),
        ),
      ).toBe(Date.parse(at(10)));
      expect(
        returnedAt(createIssue({ facts: [fact(SourceActionKind.LABEL_ADDED, at(10), label)] })),
      ).toBeNull();
      expect(returnedAt(createIssue())).toBeNull();
    });

    it('sees an update of dependencies by the branch or the task kind', () => {
      const dependencies = (sourceBranch: string, labels: string[] = []) =>
        toSignals({ issue: null, mergeRequests: [createMergeRequest({ sourceBranch, labels })] })
          .dependencies;

      expect(dependencies('renovate/eslint-10.x')).toBe(true);
      expect(dependencies('renovate-ac/eslint-10.x')).toBe(true);
      expect(dependencies('dependabot/npm_and_yarn/vite-7.1')).toBe(true);
      expect(dependencies('12-renovate-docs')).toBe(false);
      expect(dependencies('12-bump', ['type::dependency'])).toBe(true);
    });

    it('scores the engagement of an assignee and of an observer', () => {
      const own = createIssue({ mergeRequests: [createMergeRequest()] });
      const foreign = createIssue({ assignees: [OTHER], mergeRequests: [othersMergeRequest()] });

      expect(toSignals(issueLine(own)).engagement).toBe(EngagementLevel.PRIMARY);
      expect(toSignals(issueLine(foreign)).engagement).toBe(EngagementLevel.OBSERVER);
    });

    it('sees a dialog in a merge request and scores the engagement', () => {
      const mergeRequest = createMergeRequest({
        author: OTHER,
        assignees: [OTHER],
        facts: [
          otherFact(SourceActionKind.COMMENTED, at(10)),
          fact(SourceActionKind.COMMENTED, at(11)),
        ],
      });
      const issue = createIssue({ assignees: [OTHER], mergeRequests: [mergeRequest] });

      const signals = toSignals({ issue, mergeRequests: [mergeRequest] });

      expect(signals.dialog).toBe(true);
      expect(signals.assignee).toBe(false);
      expect(signals.engagement).toBe(EngagementLevel.MINOR);
    });
  });
});
