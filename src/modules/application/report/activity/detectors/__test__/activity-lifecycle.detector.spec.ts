import { describe, expect, it } from 'vitest';
import { SOURCE_CLOSED_BY_MERGE_REQUEST } from 'src/modules/application/source/constants/source.constants';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { ActivityAction, ActivityDetail } from '../../types/activity.enums';
import {
  at,
  choose,
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
} from '../../__test__/activity.fixture';

describe('ActivityLifecycleDetector', () => {
  it('tells a merge of own work from a merge of a colleague', () => {
    const own = createMergeRequest({ facts: [fact(SourceActionKind.MERGED, at(15))] });
    const other = othersMergeRequest({ iid: 6, facts: [fact(SourceActionKind.MERGED, at(16))] });

    expect(
      summarize(detect({ issue: null, event: null, pushes: [], mergeRequests: [own, other] })),
    ).toEqual([
      { action: ActivityAction.MERGED, weight: 950, state: null, details: [] },
      { action: ActivityAction.MERGED_OTHER, weight: 900, state: null, details: [] },
    ]);
  });

  it('detects closing, reopening and closing a merge request without merging', () => {
    const mergeRequest = createMergeRequest({ facts: [fact(SourceActionKind.CLOSED, at(14))] });
    const issue = createIssue({
      facts: [fact(SourceActionKind.REOPENED, at(10)), fact(SourceActionKind.CLOSED, at(17))],
      mergeRequests: [mergeRequest],
    });

    expect(summarize(detect(issueLine(issue)))).toEqual([
      { action: ActivityAction.REOPENED, weight: 880, state: null, details: [] },
      {
        action: ActivityAction.CLOSED,
        weight: 940,
        state: null,
        details: [ActivityDetail.MERGE_REQUEST],
      },
      { action: ActivityAction.CLOSED, weight: 940, state: null, details: [] },
    ]);
  });

  it('closes a task by a merge of a merge request outside the line', () => {
    const closing = { value: SOURCE_CLOSED_BY_MERGE_REQUEST };
    const issue = createIssue({
      facts: [fact(SourceActionKind.CLOSED, at(14), closing)],
      mergeRequests: [createMergeRequest({ facts: [fact(SourceActionKind.CLOSED, at(15))] })],
    });

    expect(summarize(detect(issueLine(issue)))).toEqual([
      {
        action: ActivityAction.CLOSED,
        weight: 940,
        state: null,
        details: [ActivityDetail.WITH_MERGE],
      },
      {
        action: ActivityAction.CLOSED,
        weight: 940,
        state: null,
        details: [ActivityDetail.MERGE_REQUEST],
      },
    ]);
    expect(choose(issueLine(issue)).main).toMatchObject({
      action: ActivityAction.CLOSED,
      details: [ActivityDetail.WITH_MERGE],
      parts: [expect.objectContaining({ details: [ActivityDetail.MERGE_REQUEST] })],
    });
    expect(
      summarize(
        detect(
          issueLine(
            createIssue({
              closedOnReportDate: true,
              facts: [otherFact(SourceActionKind.CLOSED, at(14), closing)],
            }),
          ),
        ),
      ),
    ).toEqual([
      {
        action: ActivityAction.COMPLETED,
        weight: 890,
        state: null,
        details: [ActivityDetail.WITH_MERGE],
      },
    ]);
  });

  it('creates a task, or finds a bug, or a regression while testing', () => {
    const created = createIssue({ facts: [fact(SourceActionKind.OPENED, at(10))] });
    const bug = createIssue({ ...created, labels: ['type::bug'] });
    const regression = createIssue({ ...created, labels: ['type::bug', 'status::testing'] });

    expect(summarize(detect(issueLine(created)))[0].action).toBe(ActivityAction.CREATED);
    expect(summarize(detect(issueLine(bug)))[0]).toMatchObject({
      action: ActivityAction.BUG_FOUND,
      weight: 750,
      details: [],
    });
    expect(summarize(detect(issueLine(regression)))[0].details).toEqual([
      ActivityDetail.REGRESSION,
    ]);
  });

  it('completes the task of an assignee when someone else closed it', () => {
    const mergeRequest = othersMergeRequest({ mergedOnReportDate: true });
    const issue = createIssue({ closedOnReportDate: true, mergeRequests: [mergeRequest] });

    expect(summarize(detect(issueLine(issue)))).toEqual([
      {
        action: ActivityAction.COMPLETED,
        weight: 890,
        state: null,
        details: [ActivityDetail.WITH_MERGE],
      },
    ]);
    expect(
      summarize(detect(issueLine(createIssue({ assignees: [OTHER], closedOnReportDate: true })))),
    ).toEqual([]);
  });

  it('marks merging and approving an update of dependencies', () => {
    const merged = othersMergeRequest({
      sourceBranch: 'renovate/eslint-10.x',
      facts: [fact(SourceActionKind.MERGED, at(15))],
    });
    const approved = othersMergeRequest({
      sourceBranch: 'dependabot/npm_and_yarn/vite-7.1',
      facts: [fact(SourceActionKind.APPROVED, at(14))],
    });

    expect(
      summarize(detect({ issue: null, event: null, pushes: [], mergeRequests: [merged] })),
    ).toEqual([
      {
        action: ActivityAction.MERGED_OTHER,
        weight: 900,
        state: null,
        details: [ActivityDetail.DEPENDENCIES],
      },
    ]);
    expect(
      summarize(detect({ issue: null, event: null, pushes: [], mergeRequests: [approved] })),
    ).toEqual([
      {
        action: ActivityAction.APPROVED,
        weight: 780,
        state: null,
        details: [ActivityDetail.DEPENDENCIES],
      },
    ]);
  });

  it('tells the assignee that the task passed testing today after the code of the day', () => {
    const passed = otherFact(SourceActionKind.LABEL_ADDED, at(14), { value: 'status::qa passed' });
    const line = (assignees: string[], facts = [passed]) =>
      issueLine(
        createIssue({
          assignees,
          facts,
          mergeRequests: [createMergeRequest({ assignees, events: [pushEvent(at(11))] })],
        }),
      );

    const choice = choose(line([OTHER, ME]));

    expect(choice.main).toMatchObject({
      action: ActivityAction.PASSED,
      weight: 790,
      time: Date.parse(at(14)),
      details: [ActivityDetail.WITH_CODE],
    });
    expect(choice.secondary).toEqual([]);
    expect(
      summarize(detect(line([OTHER]))).some((item) => item.action === ActivityAction.PASSED),
    ).toBe(false);
    expect(
      summarize(
        detect(
          line([ME], [fact(SourceActionKind.LABEL_ADDED, at(14), { value: 'status::qa passed' })]),
        ),
      ).some((item) => item.action === ActivityAction.PASSED),
    ).toBe(false);
  });

  it('tells only a rework before passed testing, not the approval and the review', () => {
    const passed = otherFact(SourceActionKind.LABEL_ADDED, at(14), { value: 'status::qa passed' });
    const mergeRequest = createMergeRequest({
      reviewThreads: { total: 1, unresolved: 0 },
      facts: [otherFact(SourceActionKind.APPROVED, at(12))],
    });
    const passedOf = (start: string[]) =>
      summarize(
        detect(
          issueLine(
            createIssue({
              startOfDay: { ...createIssue().startOfDay, labels: start },
              facts: [passed],
              mergeRequests: [mergeRequest],
            }),
          ),
        ),
      ).find((candidate) => candidate.action === ActivityAction.PASSED);

    expect(passedOf([])?.details).toEqual([]);
    expect(passedOf(['qa::returned'])?.details).toEqual([ActivityDetail.AFTER_REWORK]);
  });

  it('gives a merge the context of what came before it and how it went', () => {
    const mergeRequest = createMergeRequest({
      reviewThreads: { total: 2, unresolved: 0 },
      facts: [otherFact(SourceActionKind.APPROVED, at(14)), fact(SourceActionKind.MERGED, at(15))],
    });
    const issue = createIssue({
      labels: ['priority::critical'],
      startOfDay: { ...createIssue().startOfDay, labels: ['status::qa passed', 'qa::returned'] },
      facts: [fact(SourceActionKind.CLOSED, at(15, 0, 30))],
      mergeRequests: [mergeRequest],
    });

    expect(summarize(detect(issueLine(issue)))[0]).toEqual({
      action: ActivityAction.MERGED,
      weight: 950,
      state: null,
      details: [
        ActivityDetail.TESTED,
        ActivityDetail.AFTER_APPROVAL,
        ActivityDetail.AFTER_REWORK,
        ActivityDetail.AFTER_REVIEW,
        ActivityDetail.URGENT,
        ActivityDetail.CLOSES,
      ],
    });
  });

  it('gives a hotfix, a closing and a completed task their context too', () => {
    const hotfix = createMergeRequest({ facts: [fact(SourceActionKind.MERGED, at(15))] });
    const tested = { ...createIssue().startOfDay, labels: ['status::qa passed'] };

    expect(
      summarize(
        detect(issueLine(createIssue({ labels: ['type::hotfix'], mergeRequests: [hotfix] }))),
      )[0].details,
    ).toEqual([ActivityDetail.URGENT]);
    expect(
      summarize(
        detect(
          issueLine(
            createIssue({ startOfDay: tested, facts: [fact(SourceActionKind.CLOSED, at(16))] }),
          ),
          JobRole.PROJECT_MANAGER,
        ),
      )[0],
    ).toMatchObject({ action: ActivityAction.CLOSED, details: [ActivityDetail.TESTED] });
    expect(
      summarize(
        detect(
          issueLine(
            createIssue({
              startOfDay: tested,
              closedOnReportDate: true,
              facts: [otherFact(SourceActionKind.CLOSED, at(16))],
              mergeRequests: [othersMergeRequest({ mergedOnReportDate: true })],
            }),
          ),
        ),
      )[0],
    ).toMatchObject({
      action: ActivityAction.COMPLETED,
      details: [ActivityDetail.WITH_MERGE, ActivityDetail.TESTED],
    });
  });
});
