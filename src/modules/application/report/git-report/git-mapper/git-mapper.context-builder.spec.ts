import { GitMapperContextBuilder } from './git-mapper.context-builder';
import type {
  CleanLabelEvent,
  GroupedIssue,
  GroupedMergeRequest,
} from '../git-group/git-group.interface';
import { TaskType } from 'src/common/enums/task.enum';
import {
  GitLabIssueState,
  GitLabMergeRequestState,
} from 'src/common/enums/gitlab.enum';
import { UserRole } from 'src/modules/application/user/user.enums';

const REPORT_DATE = '2026-08-02';
const USERNAME = 'qa.user';

function buildLabelEvent(
  overrides: Partial<CleanLabelEvent> & { labelName: string },
): CleanLabelEvent {
  return {
    id: 1,
    action: 'add',
    createdAt: `${REPORT_DATE}T10:00:00.000Z`,
    username: USERNAME,
    ...overrides,
  };
}

function buildIssue(overrides: Partial<GroupedIssue> = {}): GroupedIssue {
  return {
    projectId: 1,
    iid: 10,
    title: 'Проброс эндпоинта для бакетов',
    state: GitLabIssueState.OPENED,
    closedOnReportDate: false,
    webUrl: 'https://gitlab.local/issues/10',
    labels: [],
    createdAt: `${REPORT_DATE}T09:00:00.000Z`,
    assignee: null,
    events: [],
    notes: [],
    labelEvents: [],
    mergeRequests: [],
    ...overrides,
  };
}

function buildMergeRequest(
  overrides: Partial<GroupedMergeRequest> = {},
): GroupedMergeRequest {
  return {
    projectId: 1,
    iid: 5,
    title: 'МР по задаче',
    state: GitLabMergeRequestState.OPENED,
    mergedOnReportDate: false,
    webUrl: 'https://gitlab.local/mr/5',
    sourceBranch: 'feature/x',
    labels: [],
    createdAt: `${REPORT_DATE}T09:00:00.000Z`,
    lastCommitAt: null,
    author: 'dev.author',
    assignee: 'dev.author',
    reviewers: [],
    events: [],
    notes: [],
    labelEvents: [],
    reviewThreads: { total: 0, unresolved: 0 },
    ...overrides,
  };
}

function buildContext(issue: GroupedIssue, role = UserRole.QA) {
  return new GitMapperContextBuilder().buildIssueContext(
    issue,
    USERNAME,
    role,
    REPORT_DATE,
  );
}

describe('GitMapperContextBuilder — новые QA-лейблы', () => {
  it('распознаёт статусы ready for QA и QA in progress по активным лейблам', () => {
    const context = buildContext(
      buildIssue({ labels: ['status::ready for QA'] }),
    );

    expect(context.isReadyForQa()).toBe(true);
    expect(context.isQaInProgress()).toBe(false);
  });

  it('учитывает статус, выставленный в день отчёта, даже если лейбл уже снят', () => {
    const context = buildContext(
      buildIssue({
        labels: [],
        labelEvents: [buildLabelEvent({ labelName: 'status::QA in progress' })],
      }),
    );

    expect(context.isQaInProgress()).toBe(true);
    expect(context.currentUserStartedQaTesting()).toBe(true);
  });

  it('различает автора статус-лейбла', () => {
    const context = buildContext(
      buildIssue({
        labelEvents: [
          buildLabelEvent({
            labelName: 'status::ready for QA',
            username: 'dev.user',
          }),
        ],
      }),
    );

    expect(context.isReadyForQa()).toBe(true);
    expect(context.currentUserMarkedReadyForQa()).toBe(false);
  });

  it('распознаёт возврат в разработку и его автора', () => {
    const context = buildContext(
      buildIssue({
        labels: ['qa::returned to development'],
        labelEvents: [
          buildLabelEvent({ labelName: 'qa::returned to development' }),
        ],
      }),
    );

    expect(context.isReturnedFromQa()).toBe(true);
    expect(context.currentUserReturnedTaskToDevelopment()).toBe(true);
  });

  it('снятый в тот же день возврат всё равно попадает в отчёт за день', () => {
    const context = buildContext(
      buildIssue({
        labels: [],
        labelEvents: [
          buildLabelEvent({ labelName: 'qa::returned to development' }),
          buildLabelEvent({
            id: 2,
            labelName: 'qa::returned to development',
            action: 'remove',
            createdAt: `${REPORT_DATE}T18:00:00.000Z`,
          }),
        ],
      }),
    );

    expect(context.isReturnedFromQa()).toBe(true);
  });

  it('type::qa помечает задачу как внутреннюю QA-задачу', () => {
    const context = buildContext(buildIssue({ labels: ['type::qa'] }));

    expect(context.isQaInternalTask()).toBe(true);
    expect(context.taskType).toBe(TaskType.QA_INTERNAL);
  });

  it('явный тип задачи важнее пометки type::qa', () => {
    const context = buildContext(
      buildIssue({ labels: ['type::qa', 'type::bug'] }),
    );

    expect(context.isQaInternalTask()).toBe(true);
    expect(context.taskType).toBe(TaskType.BUG);
  });

  it('test::e2e required включает признак e2e-покрытия', () => {
    const context = buildContext(
      buildIssue({ labels: ['test::e2e required'] }),
    );

    expect(context.isE2ERequired()).toBe(true);
    expect(context.needsE2ECoverage()).toBe(true);
  });

  it('не путает qa::returned to development со статус-лейблами', () => {
    const context = buildContext(
      buildIssue({
        labels: ['qa::returned to development'],
        labelEvents: [
          buildLabelEvent({ labelName: 'qa::returned to development' }),
        ],
      }),
    );

    expect(context.isQaInProgress()).toBe(false);
    expect(context.isReadyForQa()).toBe(false);
    expect(context.isDoing()).toBe(false);
  });

  it('лейбл чужого скоупа не считается типом задачи', () => {
    const context = buildContext(buildIssue({ labels: ['status::bug'] }));

    expect(context.isBug()).toBe(false);
    expect(context.taskType).toBe(TaskType.UNKNOWN);
  });

  it('снятый за день needs-rebase помечается как разрешённый', () => {
    const context = buildContext(
      buildIssue({
        labels: [],
        labelEvents: [
          buildLabelEvent({
            labelName: 'needs-rebase',
            action: 'remove',
            username: 'gitlab-bot',
          }),
        ],
      }),
      UserRole.DEVELOPER,
    );

    expect(context.currentUserResolvedRebase()).toBe(false);
  });

  it('type::epic распознаётся как эпик', () => {
    const context = buildContext(buildIssue({ labels: ['type::epic'] }));

    expect(context.isEpic()).toBe(true);
    expect(context.taskType).toBe(TaskType.EPIC);
  });

  it('апрув сам по себе делает пользователя ревьюером даже без записи в мр', () => {
    const context = buildContext(
      buildIssue({
        mergeRequests: [
          buildMergeRequest({
            reviewers: [],
            events: [
              {
                id: 1,
                projectId: 1,
                actionName: 'approved',
                targetType: null,
                targetTitle: null,
                createdAt: `${REPORT_DATE}T12:00:00.000Z`,
              },
            ],
          }),
        ],
      }),
      UserRole.DEVELOPER,
    );

    expect(context.isReviewer()).toBe(true);
    expect(context.currentUserApproved()).toBe(true);
  });

  it('собирает заголовки коммитов для распознавания работы над тестами', () => {
    const context = buildContext(
      buildIssue({
        labels: ['test::e2e required'],
        mergeRequests: [
          {
            projectId: 1,
            iid: 5,
            title: 'e2e для бакетов',
            state: 'opened' as never,
            mergedOnReportDate: false,
            webUrl: 'https://gitlab.local/mr/5',
            sourceBranch: 'feature/e2e',
            labels: [],
            createdAt: `${REPORT_DATE}T09:30:00.000Z`,
            lastCommitAt: null,
            author: USERNAME,
            assignee: USERNAME,
            reviewers: [],
            events: [
              {
                id: 1,
                projectId: 1,
                actionName: 'pushed to',
                targetType: null,
                targetTitle: null,
                createdAt: `${REPORT_DATE}T11:00:00.000Z`,
                pushData: {
                  commitCount: 1,
                  action: 'pushed',
                  refType: 'branch',
                  ref: 'feature/e2e',
                  commitTitle: 'test: add e2e specs',
                },
              },
            ],
            notes: [],
            labelEvents: [],
            reviewThreads: { total: 0, unresolved: 0 },
          },
        ],
      }),
      UserRole.DEVELOPER,
    );

    expect(context.hasTestRelatedCommits()).toBe(true);
    expect(context.isE2ECoverageWork()).toBe(true);
  });
});
