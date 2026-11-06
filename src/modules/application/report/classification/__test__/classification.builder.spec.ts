import { describe, expect, it } from 'vitest';
import { LabelAction } from 'src/modules/application/source/source.enums';
import type { GroupedIssue } from 'src/modules/application/source/source.interface';
import { TaskKind } from 'src/modules/application/trait/trait.enums';
import { JobRole } from 'src/modules/application/user/user.enums';
import {
  createBuilder,
  createEvent,
  createIssue,
  createLabelEvent,
  createMergeRequest,
  createNote,
  createV1TraitIndex,
  REPORT_DATE,
  USERNAME,
} from './classification.fixture';

const INDEX = createV1TraitIndex();

function buildContext(issue: GroupedIssue, role = JobRole.QA) {
  return createBuilder().buildIssueContext(issue, { username: USERNAME, role }, INDEX, REPORT_DATE);
}

describe('ClassificationBuilder', () => {
  it('reads ready for QA from the labels at the end of the day', () => {
    const context = buildContext(createIssue({ labels: ['status::ready for QA'] }));

    expect(context.isReadyForQa()).toBe(true);
    expect(context.isTesting()).toBe(false);
  });

  it('counts a state set on the day even if the label is gone', () => {
    const context = buildContext(
      createIssue({
        labelEvents: [createLabelEvent({ labelName: 'status::QA in progress' })],
      }),
    );

    expect(context.isTesting()).toBe(true);
    expect(context.currentUserStartedTesting()).toBe(true);
  });

  it('tells who set the state', () => {
    const context = buildContext(
      createIssue({
        labelEvents: [
          createLabelEvent({ labelName: 'status::ready for QA', username: 'dev.user' }),
        ],
      }),
    );

    expect(context.isReadyForQa()).toBe(true);
    expect(context.currentUserMarkedReadyForQa()).toBe(false);
  });

  it('reads the return to development and who returned it', () => {
    const context = buildContext(
      createIssue({
        labels: ['qa::returned to development'],
        labelEvents: [createLabelEvent({ labelName: 'qa::returned to development' })],
      }),
    );

    expect(context.isReturnedFromQa()).toBe(true);
    expect(context.currentUserReturnedTaskToDevelopment()).toBe(true);
  });

  it('keeps a return that was removed on the same day', () => {
    const context = buildContext(
      createIssue({
        labelEvents: [
          createLabelEvent({ labelName: 'qa::returned to development' }),
          createLabelEvent({
            id: 2,
            labelName: 'qa::returned to development',
            action: LabelAction.REMOVE,
            createdAt: `${REPORT_DATE}T18:00:00.000Z`,
          }),
        ],
      }),
    );

    expect(context.isReturnedFromQa()).toBe(true);
  });

  it('marks type::qa as an internal QA task', () => {
    const context = buildContext(createIssue({ labels: ['type::qa'] }));

    expect(context.isQaInternalTask()).toBe(true);
    expect(context.kind).toBe(TaskKind.QA_INTERNAL);
  });

  it('prefers an explicit kind to type::qa', () => {
    const context = buildContext(createIssue({ labels: ['type::qa', 'type::bug'] }));

    expect(context.isQaInternalTask()).toBe(true);
    expect(context.kind).toBe(TaskKind.BUG);
  });

  it('turns test::e2e required into a need for e2e coverage', () => {
    const context = buildContext(createIssue({ labels: ['test::e2e required'] }));

    expect(context.isE2ERequired()).toBe(true);
    expect(context.needsE2ECoverage()).toBe(true);
  });

  it('does not take qa::returned to development for a state', () => {
    const context = buildContext(
      createIssue({
        labels: ['qa::returned to development'],
        labelEvents: [createLabelEvent({ labelName: 'qa::returned to development' })],
      }),
    );

    expect(context.isTesting()).toBe(false);
    expect(context.isReadyForQa()).toBe(false);
    expect(context.isDoing()).toBe(false);
  });

  it('does not take a label of another scope for a kind', () => {
    const context = buildContext(createIssue({ labels: ['status::bug'] }));

    expect(context.isBug()).toBe(false);
    expect(context.kind).toBeNull();
  });

  it('does not credit a rebase without a push', () => {
    const context = buildContext(
      createIssue({
        labelEvents: [
          createLabelEvent({
            labelName: 'needs-rebase',
            action: LabelAction.REMOVE,
            username: 'gitlab-bot',
          }),
        ],
      }),
      JobRole.DEVELOPER,
    );

    expect(context.currentUserResolvedRebase()).toBe(false);
  });

  it('reads type::epic as an epic', () => {
    const context = buildContext(createIssue({ labels: ['type::epic'] }));

    expect(context.isEpic()).toBe(true);
    expect(context.kind).toBe(TaskKind.EPIC);
  });

  it('makes an approver a reviewer even without a review request', () => {
    const context = buildContext(
      createIssue({
        mergeRequests: [createMergeRequest({ events: [createEvent({ actionName: 'approved' })] })],
      }),
      JobRole.DEVELOPER,
    );

    expect(context.isReviewer()).toBe(true);
    expect(context.currentUserApproved()).toBe(true);
  });

  it('collects commit titles to see work on tests', () => {
    const context = buildContext(
      createIssue({
        labels: ['test::e2e required'],
        mergeRequests: [
          createMergeRequest({
            author: USERNAME,
            assignees: [USERNAME],
            events: [
              createEvent({
                actionName: 'pushed to',
                pushData: {
                  commitCount: 1,
                  action: 'pushed',
                  refType: 'branch',
                  ref: '10-branch',
                  commitTitle: 'test: add e2e specs',
                  commits: [],
                },
              }),
            ],
          }),
        ],
      }),
      JobRole.DEVELOPER,
    );

    expect(context.hasTestRelatedCommits()).toBe(true);
    expect(context.isE2ECoverageWork()).toBe(true);
  });

  it('reads the role in the task from the first assignee, reviewers and the issue author', () => {
    const builder = createBuilder();
    const employee = { username: USERNAME, role: JobRole.DEVELOPER };
    const toContext = (issue: GroupedIssue) =>
      builder.buildIssueContext(issue, employee, INDEX, REPORT_DATE);

    expect(toContext(createIssue({ assignees: [USERNAME, 'dev.user'] })).isAssignee()).toBe(true);
    expect(
      toContext(
        createIssue({ mergeRequests: [createMergeRequest({ reviewers: [USERNAME] })] }),
      ).isReviewer(),
    ).toBe(true);
    expect(
      toContext(createIssue({ events: [createEvent({ actionName: 'created' })] })).isAuthor(),
    ).toBe(true);
    expect(toContext(createIssue()).isObserver()).toBe(true);
  });

  it('counts comments and approvals of others in the merge request', () => {
    const context = createBuilder().buildMergeRequestContext(
      createMergeRequest({
        labels: ['status::review'],
        notes: [
          createNote(),
          createNote({ id: 2, authorUsername: 'dev.user' }),
          createNote({
            id: 3,
            authorUsername: 'dev.user',
            system: true,
            body: 'approved this merge request',
          }),
        ],
      }),
      { username: USERNAME, role: JobRole.DEVELOPER },
      INDEX,
      REPORT_DATE,
    );

    expect(context.isStandaloneMergeRequest()).toBe(true);
    expect(context.isInReview()).toBe(true);
    expect(context.hasReviewDialog()).toBe(true);
    expect(context.isApprovedByOtherUsers()).toBe(true);
  });
});
