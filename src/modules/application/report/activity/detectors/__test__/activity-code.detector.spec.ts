import { describe, expect, it } from 'vitest';
import {
  SourceActionKind,
  SourceEventAction,
  SourceRefType,
} from 'src/modules/application/source/types/source.enums';
import type { GroupedMergeRequest } from 'src/modules/application/source/types/source-day.interface';
import { ActivityAction, ActivityDetail } from '../../types/activity.enums';
import {
  at,
  createIssue,
  createMergeRequest,
  detect,
  fact,
  issueLine,
  OTHER,
  otherFact,
  othersMergeRequest,
  pushEvent,
  pushLine,
  refEvent,
  summarize,
} from '../../__test__/activity.fixture';

function codeOf(mergeRequest: GroupedMergeRequest, issue = createIssue()) {
  return summarize(detect(issueLine({ ...issue, mergeRequests: [mergeRequest] }))).find(
    (candidate) =>
      candidate.action === ActivityAction.CODE || candidate.action === ActivityAction.HELPED,
  );
}

describe('ActivityCodeDetector', () => {
  it('weighs plain work on code', () => {
    expect(codeOf(createMergeRequest({ events: [pushEvent(at(11))] }))).toEqual({
      action: ActivityAction.CODE,
      weight: 300,
      state: null,
      details: [],
    });
  });

  it('sees work on review remarks, after testing, on a rebase and on tests', () => {
    const mergeRequest = createMergeRequest({
      reviewers: [OTHER],
      startOfDay: { ...createMergeRequest().startOfDay, labels: ['qa::returned'] },
      facts: [
        otherFact(SourceActionKind.COMMENTED, at(9)),
        otherFact(SourceActionKind.LABEL_REMOVED, at(10), { value: 'needs-rebase' }),
      ],
      events: [pushEvent(at(11), ['Поправил тесты оплаты'])],
    });

    expect(codeOf(mergeRequest)).toEqual({
      action: ActivityAction.CODE,
      weight: 350,
      state: null,
      details: [
        ActivityDetail.AFTER_REVIEW,
        ActivityDetail.AFTER_QA,
        ActivityDetail.REBASE,
        ActivityDetail.TESTS,
      ],
    });
  });

  it('sees work after a return from QA during the day', () => {
    const returned = (time: string) =>
      createIssue({
        facts: [otherFact(SourceActionKind.LABEL_ADDED, time, { value: 'qa::returned' })],
      });
    const mergeRequest = createMergeRequest({ events: [pushEvent(at(11))] });

    expect(codeOf(mergeRequest, returned(at(10)))?.details).toEqual([ActivityDetail.AFTER_QA]);
    expect(codeOf(mergeRequest, returned(at(12)))?.details).toEqual([]);
  });

  it('sees work on review remarks by the threads of the merge request', () => {
    const threads = (unresolved: number) =>
      codeOf(
        createMergeRequest({
          reviewThreads: { total: 3, unresolved },
          events: [pushEvent(at(11))],
        }),
      )?.details;

    expect(threads(2)).toEqual([ActivityDetail.AFTER_REVIEW]);
    expect(threads(0)).toEqual([ActivityDetail.AFTER_REVIEW, ActivityDetail.RESOLVED]);
  });

  it('takes a conversation outside a review for a discussion, not for review remarks', () => {
    const conversation = (labels: string[]) =>
      summarize(
        detect(
          issueLine(
            createIssue({
              labels,
              mergeRequests: [
                createMergeRequest({
                  facts: [
                    otherFact(SourceActionKind.COMMENTED, at(9)),
                    fact(SourceActionKind.COMMENTED, at(10)),
                  ],
                  events: [pushEvent(at(11))],
                }),
              ],
            }),
          ),
        ),
      ).map(({ action, details }) => [action, details]);

    expect(conversation([])).toEqual([
      [ActivityAction.CODE, []],
      [ActivityAction.DISCUSSED, [ActivityDetail.DIALOG]],
    ]);
    expect(conversation(['status::review'])[0]).toEqual([
      ActivityAction.CODE,
      [ActivityDetail.AFTER_REVIEW],
    ]);
  });

  it('sees a change of a line under a review remark', () => {
    const mergeRequest = createMergeRequest({
      facts: [fact(SourceActionKind.DIFF_LINE_CHANGED, at(11))],
      events: [pushEvent(at(11))],
    });

    expect(codeOf(mergeRequest)?.details).toEqual([ActivityDetail.AFTER_REVIEW]);
  });

  it('sees started, resumed and refactoring work', () => {
    const started = createMergeRequest({
      facts: [fact(SourceActionKind.OPENED, at(9))],
      events: [pushEvent(at(11))],
    });
    const resumed = createMergeRequest({
      lastCommitAt: '2026-07-20T10:00:00.000Z',
      events: [pushEvent(at(11))],
    });

    expect(codeOf(started)?.details).toEqual([ActivityDetail.STARTED]);
    expect(codeOf(resumed)).toMatchObject({ weight: 315, details: [ActivityDetail.RESUMED] });
    expect(
      codeOf(
        createMergeRequest({ events: [pushEvent(at(11))] }),
        createIssue({ labels: ['type::maintenance'] }),
      ),
    ).toMatchObject({ weight: 310, details: [ActivityDetail.REFACTORING] });
  });

  it('starts work by creating a branch or opening a merge request without pushes', () => {
    const branch = createIssue({ facts: [fact(SourceActionKind.BRANCH_CREATED, at(9))] });
    const opened = createMergeRequest({ facts: [fact(SourceActionKind.OPENED, at(9))] });

    expect(summarize(detect(issueLine(branch)))).toEqual([
      { action: ActivityAction.CODE, weight: 320, state: null, details: [ActivityDetail.STARTED] },
    ]);
    expect(codeOf(opened)).toEqual({
      action: ActivityAction.CODE,
      weight: 320,
      state: null,
      details: [ActivityDetail.STARTED],
    });
  });

  it('closes review remarks in an own merge request with and without pushes', () => {
    const resolved = fact(SourceActionKind.THREADS_RESOLVED, at(12));

    expect(
      codeOf(createMergeRequest({ facts: [resolved], events: [pushEvent(at(11))] })),
    ).toMatchObject({ weight: 350, details: [ActivityDetail.RESOLVED] });
    expect(codeOf(createMergeRequest({ facts: [resolved] }))).toEqual({
      action: ActivityAction.CODE,
      weight: 350,
      state: null,
      details: [ActivityDetail.RESOLVED],
    });
  });

  it('continues work on a draft merge request', () => {
    const draft = createMergeRequest({ draft: true, events: [pushEvent(at(11))] });
    const markedDraft = createMergeRequest({
      facts: [fact(SourceActionKind.MARKED_DRAFT, at(10))],
      events: [pushEvent(at(11))],
    });

    expect(codeOf(draft)?.details).toEqual([ActivityDetail.DRAFT]);
    const candidates = detect(issueLine({ ...createIssue(), mergeRequests: [markedDraft] }));
    expect(summarize(candidates)).toEqual([
      { action: ActivityAction.CODE, weight: 300, state: null, details: [ActivityDetail.DRAFT] },
    ]);
  });

  it('works on dependencies in a merge request of a bot', () => {
    const mergeRequest = othersMergeRequest({
      author: 'renovate-bot',
      sourceBranch: 'renovate-ac/eslint-10.x',
      events: [pushEvent(at(11))],
    });

    expect(codeOf(mergeRequest, createIssue({ assignees: [OTHER] }))).toEqual({
      action: ActivityAction.CODE,
      weight: 300,
      state: null,
      details: [ActivityDetail.DEPENDENCIES],
    });
  });

  it('commits directly to a main branch', () => {
    const [candidate] = summarize(
      detect(pushLine({ ref: 'main', mainBranch: true, events: [pushEvent(at(11))] })),
    );

    expect(candidate).toEqual({
      action: ActivityAction.CODE,
      weight: 300,
      state: null,
      details: [ActivityDetail.DIRECT],
    });
  });

  it('pushes to many branches at once without starting work', () => {
    const bulk = (actionName: SourceEventAction) =>
      summarize(
        detect(
          pushLine({
            ref: null,
            events: [refEvent(at(11), actionName, { ref: null, refCount: 5 })],
          }),
        ),
      );

    expect(bulk(SourceEventAction.PUSHED_TO)).toEqual([
      { action: ActivityAction.CODE, weight: 300, state: null, details: [ActivityDetail.MANY] },
    ]);
    expect(bulk(SourceEventAction.PUSHED_NEW)[0].details).toEqual([ActivityDetail.MANY]);
  });

  it('takes no tag and no deleted branch for work on code', () => {
    const tag = pushLine({
      ref: 'v1.4.0',
      refType: SourceRefType.TAG,
      events: [
        refEvent(at(11), SourceEventAction.PUSHED_NEW, {
          refType: SourceRefType.TAG,
          ref: 'v1.4.0',
        }),
      ],
    });
    const deleted = pushLine({ events: [refEvent(at(11), SourceEventAction.DELETED)] });

    expect(summarize(detect(tag)).map(({ action }) => action)).toEqual([ActivityAction.RELEASED]);
    expect(summarize(detect(deleted)).map(({ action }) => action)).toEqual([
      ActivityAction.DELETED,
    ]);
  });

  it('works on a task mentioned in a commit of another branch', () => {
    const mention = fact(SourceActionKind.COMMIT_MENTIONED, at(11), { value: 'abc1234' });
    const ownCommit = refEvent(at(11), SourceEventAction.PUSHED_TO, {
      commitCount: 1,
      commits: [{ id: 'abc1234def5678', title: 'fix: #12 the login' }],
    });

    expect(summarize(detect(issueLine(createIssue({ facts: [mention] }))))).toEqual([
      {
        action: ActivityAction.CODE,
        weight: 300,
        state: null,
        details: [ActivityDetail.MENTIONED],
      },
    ]);
    expect(
      codeOf(createMergeRequest({ events: [ownCommit] }), createIssue({ facts: [mention] })),
    ).toEqual({ action: ActivityAction.CODE, weight: 300, state: null, details: [] });
  });

  it('helps with a task of someone else', () => {
    const mergeRequest = othersMergeRequest({
      facts: [
        otherFact(SourceActionKind.COMMENTED, at(9)),
        fact(SourceActionKind.COMMENTED, at(10)),
      ],
      events: [pushEvent(at(11))],
    });

    expect(codeOf(mergeRequest, createIssue({ assignees: [OTHER] }))).toEqual({
      action: ActivityAction.HELPED,
      weight: 180,
      state: null,
      details: [ActivityDetail.DIALOG],
    });
  });
});
