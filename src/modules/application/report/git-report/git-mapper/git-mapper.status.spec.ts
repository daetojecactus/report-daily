import { TaskContext } from './git-mapper.context';
import { GitMapperStatusResolver } from './git-mapper.status';
import { TaskRole } from './git-mapper.enums';
import type { TaskContextData } from './git-mapper.interface';
import { TaskStatus, TaskType } from 'src/common/enums/task.enum';
import {
  LabelPriority,
  LabelQa,
  LabelStatus,
  LabelTest,
  LabelType,
} from 'src/common/enums/label.enum';
import {
  GitLabAction,
  GitLabIssueState,
  GitLabMergeRequestState,
} from 'src/common/enums/gitlab.enum';
import { UserRole } from 'src/modules/application/user/user.enums';

const REPORT_DATE = '2026-08-02';

type ContextOverrides = {
  role?: UserRole;
  taskRole?: TaskRole;
  taskType?: TaskType;
  isMergeRequestAuthor?: boolean;
  labels?: Partial<TaskContextData['labels']>;
  activityStream?: Partial<TaskContextData['activityStream']>;
  approvals?: Partial<TaskContextData['approvals']>;
};

//контекст задачи с нейтральными значениями: тест задаёт только значимые для правила сигналы
function buildContext(overrides: ContextOverrides = {}): TaskContext {
  return new TaskContext({
    currentUserGlobalRole: overrides.role ?? UserRole.DEVELOPER,
    userRoleInTask: overrides.taskRole ?? TaskRole.ASSIGNEE,
    isMergeRequestAuthor: overrides.isMergeRequestAuthor ?? false,
    taskType: overrides.taskType ?? TaskType.UNKNOWN,
    taskDates: {
      mergeRequestCreatedAt: null,
      mergeRequestLastCommitAt: null,
      reportDate: REPORT_DATE,
    },
    labels: {
      priorities: [],
      types: [],
      currentStatus: null,
      previousStatus: null,
      statusLabelsSetByCurrentUser: [],
      priorityChangedByCurrentUser: false,
      activeStatuses: [],
      qaFlags: [],
      qaFlagsSetByCurrentUser: [],
      testFlags: [],
      needsRebase: false,
      needsRebaseResolved: false,
      ...overrides.labels,
    },
    activityStream: {
      issueState: null,
      mergeRequestState: null,
      issueClosedOnReportDate: false,
      mergeRequestMergedOnReportDate: false,
      issueActions: [],
      mergeRequestActions: [],
      issueCommentsFromCurrentUser: 0,
      mergeRequestCommentsFromCurrentUser: 0,
      mergeRequestCommentsFromOthers: 0,
      mergeRequestCommitCount: 0,
      commitTitles: [],
      reviewThreadCount: 0,
      unresolvedReviewThreadCount: 0,
      ...overrides.activityStream,
    },
    approvals: {
      currentUserApproved: false,
      otherApprovers: [],
      ...overrides.approvals,
    },
  });
}

//пуш кода в мр за день отчёта
const pushed = (commitTitles: string[] = []) => ({
  mergeRequestState: null,
  mergeRequestActions: [GitLabAction.PUSHED_TO],
  mergeRequestCommitCount: commitTitles.length || 1,
  commitTitles,
});

describe('GitMapperStatusResolver — глобальные QA-лейблы', () => {
  let resolver: GitMapperStatusResolver;

  beforeEach(() => {
    resolver = new GitMapperStatusResolver();
  });

  describe('сценарий 1: status::ready for QA', () => {
    it('разработчик, навесивший лейбл, передал задачу на тестирование', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: {
          currentStatus: LabelStatus.READY_FOR_QA,
          statusLabelsSetByCurrentUser: [LabelStatus.READY_FOR_QA],
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.TASK_SENT_TO_QA);
    });

    it('разработчик-исполнитель получает статус и когда лейбл навесил кто-то другой', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { activeStatuses: [LabelStatus.READY_FOR_QA] },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.TASK_SENT_TO_QA);
    });

    it('для QA задача попадает в очередь на тестирование', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskRole: TaskRole.OBSERVER,
        labels: { currentStatus: LabelStatus.READY_FOR_QA },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.QA_AWAITING_TESTING);
    });
  });

  describe('сценарий 2: status::QA in progress', () => {
    it('QA, взявший задачу в работу, проводит тестирование', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskRole: TaskRole.OBSERVER,
        labels: {
          currentStatus: LabelStatus.QA_IN_PROGRESS,
          statusLabelsSetByCurrentUser: [LabelStatus.QA_IN_PROGRESS],
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.QA_IN_PROGRESS);
    });

    it('QA-ревьюер, взявший задачу в работу, тоже тестирует', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskRole: TaskRole.REVIEWER,
        labels: {
          currentStatus: LabelStatus.QA_IN_PROGRESS,
          statusLabelsSetByCurrentUser: [LabelStatus.QA_IN_PROGRESS],
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.QA_IN_PROGRESS);
    });

    it('закрытие задачи приоритетнее взятия в тестирование', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskRole: TaskRole.OBSERVER,
        labels: {
          currentStatus: LabelStatus.QA_IN_PROGRESS,
          statusLabelsSetByCurrentUser: [LabelStatus.QA_IN_PROGRESS],
        },
        activityStream: {
          issueActions: [GitLabAction.CLOSED],
          issueClosedOnReportDate: true,
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.VERIFIED_FIX);
    });

    it('для разработчика-исполнителя задача на тестировании у QA', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { activeStatuses: [LabelStatus.QA_IN_PROGRESS] },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.TASK_IN_QA_TESTING);
    });
  });

  describe('сценарий 3: qa::returned to development', () => {
    it('QA, навесивший лейбл, вернул задачу на доработку', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskRole: TaskRole.OBSERVER,
        labels: {
          qaFlags: [LabelQa.RETURNED_TO_DEVELOPMENT],
          qaFlagsSetByCurrentUser: [LabelQa.RETURNED_TO_DEVELOPMENT],
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.QA_RETURNED_TO_DEV);
    });

    it('возврат в разработку приоритетнее комментариев и статуса задачи', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskRole: TaskRole.REVIEWER,
        taskType: TaskType.BUG,
        labels: {
          currentStatus: LabelStatus.QA_IN_PROGRESS,
          qaFlags: [LabelQa.RETURNED_TO_DEVELOPMENT],
          qaFlagsSetByCurrentUser: [LabelQa.RETURNED_TO_DEVELOPMENT],
        },
        activityStream: { mergeRequestCommentsFromCurrentUser: 5 },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.QA_RETURNED_TO_DEV);
    });

    it('разработчик, пушащий код в возвращённую задачу, правит замечания', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { qaFlags: [LabelQa.RETURNED_TO_DEVELOPMENT] },
        activityStream: pushed(['fix: validation error']),
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.DEV_FIXING_AFTER_QA);
    });

    it('разработчик-исполнитель без пушей всё равно числится на доработке', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { qaFlags: [LabelQa.RETURNED_TO_DEVELOPMENT] },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.DEV_FIXING_AFTER_QA);
    });

    it('разработчик, исправивший замечания и вернувший задачу на тест', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: {
          qaFlags: [LabelQa.RETURNED_TO_DEVELOPMENT],
          currentStatus: LabelStatus.READY_FOR_QA,
          statusLabelsSetByCurrentUser: [LabelStatus.READY_FOR_QA],
        },
        activityStream: pushed(['fix: qa remarks']),
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.DEV_RESUBMITTED_TO_QA);
    });
  });

  describe('сценарий 4: type::qa', () => {
    it('QA с пушами разрабатывает автотесты, а не тестирует руками', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskType: TaskType.QA_INTERNAL,
        labels: { types: [LabelType.QA] },
        activityStream: pushed(['feat: add account tests']),
      });

      expect(resolver.resolve(context)).toBe(
        TaskStatus.QA_AUTOMATION_DEVELOPED,
      );
    });

    it('починка упавших тестов в maintenance-задаче — поддержка автотестов', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskType: TaskType.CHORE,
        labels: { types: [LabelType.QA, LabelType.MAINTENANCE] },
        activityStream: pushed(['fix: flaky tests']),
      });

      expect(resolver.resolve(context)).toBe(
        TaskStatus.QA_AUTOMATION_MAINTAINED,
      );
    });

    it('работа без кода над maintenance-задачей — настройка окружения', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskType: TaskType.CHORE,
        labels: { types: [LabelType.QA, LabelType.MAINTENANCE] },
        activityStream: { issueCommentsFromCurrentUser: 2 },
      });

      expect(resolver.resolve(context)).toBe(
        TaskStatus.QA_TEST_ENVIRONMENT_SETUP,
      );
    });

    it('без иных признаков остаётся внутренняя QA-задача', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskType: TaskType.QA_INTERNAL,
        labels: { types: [LabelType.QA] },
        activityStream: { issueCommentsFromCurrentUser: 1 },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.QA_INTERNAL_TASK);
    });

    it('разработчик, пушащий код во внутреннюю QA-задачу, тоже пишет автотесты', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        taskType: TaskType.QA_INTERNAL,
        labels: { types: [LabelType.QA] },
        activityStream: pushed(['chore: page objects']),
      });

      expect(resolver.resolve(context)).toBe(
        TaskStatus.QA_AUTOMATION_DEVELOPED,
      );
    });

    it('мердж своей QA-задачи не превращается в продуктовую фичу', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskType: TaskType.QA_INTERNAL,
        isMergeRequestAuthor: true,
        labels: { types: [LabelType.QA] },
        activityStream: {
          mergeRequestActions: [GitLabAction.PUSHED_TO, GitLabAction.ACCEPTED],
          mergeRequestCommitCount: 3,
          commitTitles: ['test: ssl admin cases'],
        },
      });

      expect(resolver.resolve(context)).toBe(
        TaskStatus.QA_AUTOMATION_DEVELOPED,
      );
    });

    it('мердж QA-задачи засчитывается и без пуша в день отчёта', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskType: TaskType.QA_INTERNAL,
        isMergeRequestAuthor: true,
        labels: { types: [LabelType.QA] },
        activityStream: { mergeRequestActions: [GitLabAction.ACCEPTED] },
      });

      expect(resolver.resolve(context)).toBe(
        TaskStatus.QA_AUTOMATION_DEVELOPED,
      );
    });
  });

  describe('сценарий 5: test::e2e required', () => {
    it('QA, пушащий код в задачу с лейблом, разрабатывает E2E-покрытие', () => {
      const context = buildContext({
        role: UserRole.QA,
        labels: { testFlags: [LabelTest.E2E_REQUIRED] },
        activityStream: pushed(['add checkout flow']),
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.QA_E2E_COVERAGE_ADDED);
    });

    it('разработчик с коммитами по тестам разрабатывает E2E-покрытие', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { testFlags: [LabelTest.E2E_REQUIRED] },
        activityStream: pushed(['test: e2e for bucket page']),
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.QA_E2E_COVERAGE_ADDED);
    });

    it('разработчик без коммитов по тестам продолжает писать продуктовый код', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { testFlags: [LabelTest.E2E_REQUIRED] },
        activityStream: {
          ...pushed(['feat: bucket endpoint']),
          mergeRequestState: null,
        },
      });

      expect(resolver.resolve(context)).not.toBe(
        TaskStatus.QA_E2E_COVERAGE_ADDED,
      );
    });

    it('мердж своего e2e-мр засчитывается QA и без пуша в день отчёта', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskType: TaskType.FEATURE,
        isMergeRequestAuthor: true,
        labels: { testFlags: [LabelTest.E2E_REQUIRED] },
        activityStream: { mergeRequestActions: [GitLabAction.ACCEPTED] },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.QA_E2E_COVERAGE_ADDED);
    });

    it('мердж e2e-покрытия остаётся работой над тестами', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        taskType: TaskType.FEATURE,
        isMergeRequestAuthor: true,
        labels: { testFlags: [LabelTest.E2E_REQUIRED] },
        activityStream: {
          mergeRequestActions: [GitLabAction.PUSHED_TO, GitLabAction.ACCEPTED],
          mergeRequestCommitCount: 2,
          commitTitles: ['test: add e2e specs'],
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.QA_E2E_COVERAGE_ADDED);
    });
  });

  describe('PM и системный аналитик', () => {
    it.each([UserRole.PROJECT_MANAGER, UserRole.SYSTEM_ANALYST])(
      'роль %s: сам передал задачу на тестирование',
      (role) => {
        const context = buildContext({
          role,
          taskRole: TaskRole.AUTHOR,
          labels: {
            currentStatus: LabelStatus.READY_FOR_QA,
            statusLabelsSetByCurrentUser: [LabelStatus.READY_FOR_QA],
          },
        });

        expect(resolver.resolve(context)).toBe(TaskStatus.TASK_SENT_TO_QA);
      },
    );

    it.each([UserRole.PROJECT_MANAGER, UserRole.SYSTEM_ANALYST])(
      'роль %s: задача вернулась с тестирования',
      (role) => {
        const context = buildContext({
          role,
          taskRole: TaskRole.AUTHOR,
          labels: { qaFlags: [LabelQa.RETURNED_TO_DEVELOPMENT] },
          activityStream: { issueCommentsFromCurrentUser: 1 },
        });

        expect(resolver.resolve(context)).toBe(
          TaskStatus.TASK_RETURNED_FROM_QA,
        );
      },
    );

    it.each([UserRole.PROJECT_MANAGER, UserRole.SYSTEM_ANALYST])(
      'роль %s: задача проходит тестирование',
      (role) => {
        const context = buildContext({
          role,
          taskRole: TaskRole.AUTHOR,
          labels: { activeStatuses: [LabelStatus.QA_IN_PROGRESS] },
          activityStream: { issueCommentsFromCurrentUser: 1 },
        });

        expect(resolver.resolve(context)).toBe(TaskStatus.TASK_IN_QA_TESTING);
      },
    );

    it('закрытие задачи приоритетнее QA-контекста', () => {
      const context = buildContext({
        role: UserRole.PROJECT_MANAGER,
        taskRole: TaskRole.AUTHOR,
        taskType: TaskType.FEATURE,
        labels: { qaFlags: [LabelQa.RETURNED_TO_DEVELOPMENT] },
        activityStream: {
          issueActions: [GitLabAction.CLOSED],
          issueClosedOnReportDate: true,
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.REVIEWED_AND_CLOSED);
    });
  });

  describe('status::QA passed', () => {
    it('QA, подтвердивший прохождение тестирования', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskRole: TaskRole.OBSERVER,
        labels: {
          currentStatus: LabelStatus.QA_PASSED,
          statusLabelsSetByCurrentUser: [LabelStatus.QA_PASSED],
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.TESTED_AND_APPROVED);
    });

    it('разработчик получает статус успешно пройденного тестирования', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { activeStatuses: [LabelStatus.QA_PASSED] },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.DEV_PASSED_QA);
    });

    it('для PM задача остаётся в контуре тестирования', () => {
      const context = buildContext({
        role: UserRole.PROJECT_MANAGER,
        taskRole: TaskRole.AUTHOR,
        labels: { activeStatuses: [LabelStatus.QA_PASSED] },
        activityStream: { issueCommentsFromCurrentUser: 1 },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.TASK_IN_QA_TESTING);
    });
  });

  describe('status::hold', () => {
    it.each([UserRole.DEVELOPER, UserRole.QA, UserRole.PROJECT_MANAGER])(
      'роль %s: отложенная задача даёт PUT_ON_HOLD',
      (role) => {
        const context = buildContext({
          role,
          labels: {
            currentStatus: LabelStatus.HOLD,
            statusLabelsSetByCurrentUser: [LabelStatus.HOLD],
          },
          activityStream: pushed(['wip']),
        });

        expect(resolver.resolve(context)).toBe(TaskStatus.PUT_ON_HOLD);
      },
    );

    it('закрытие задачи важнее её откладывания', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: {
          currentStatus: LabelStatus.HOLD,
          statusLabelsSetByCurrentUser: [LabelStatus.HOLD],
        },
        activityStream: {
          issueState: GitLabIssueState.CLOSED,
          issueActions: [GitLabAction.CLOSED],
          issueClosedOnReportDate: true,
        },
      });

      expect(resolver.resolve(context)).not.toBe(TaskStatus.PUT_ON_HOLD);
    });
  });

  describe('планирование спринта (status::todo / sprint backlog)', () => {
    it.each([LabelStatus.TODO, LabelStatus.SPRINT_BACKLOG])(
      'PM, поставивший %s, планирует задачу',
      (status) => {
        const context = buildContext({
          role: UserRole.PROJECT_MANAGER,
          taskRole: TaskRole.AUTHOR,
          labels: {
            currentStatus: status,
            statusLabelsSetByCurrentUser: [status],
          },
        });

        expect(resolver.resolve(context)).toBe(TaskStatus.PLANNED_FOR_SPRINT);
      },
    );
  });

  describe('needs-rebase и test::unit', () => {
    it('снятый needs-rebase вместе с пушем даёт разрешение конфликтов', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { needsRebaseResolved: true },
        activityStream: pushed(['merge branch main']),
      });

      expect(resolver.resolve(context)).toBe(
        TaskStatus.RESOLVED_MERGE_CONFLICTS,
      );
    });

    it('снятый needs-rebase без пуша не даёт статуса', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { needsRebaseResolved: true },
        activityStream: { issueCommentsFromCurrentUser: 1 },
      });

      expect(resolver.resolve(context)).not.toBe(
        TaskStatus.RESOLVED_MERGE_CONFLICTS,
      );
    });

    it('коммиты с юнит-тестами по задаче с test::unit', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { testFlags: [LabelTest.UNIT] },
        activityStream: pushed(['test: cover service with unit specs']),
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.WROTE_TESTS);
    });
  });

  describe('закрытие задачи — событие дня, а не её состояние', () => {
    it('QA, комментирующий давно закрытую задачу, не «принимает исправление»', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskRole: TaskRole.OBSERVER,
        activityStream: {
          issueState: GitLabIssueState.CLOSED,
          issueClosedOnReportDate: false,
          issueCommentsFromCurrentUser: 1,
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.COMMENTED);
    });

    it('закрытие задачи в день отчёта засчитывается QA как приёмка', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskRole: TaskRole.OBSERVER,
        activityStream: {
          issueState: GitLabIssueState.CLOSED,
          issueClosedOnReportDate: true,
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.VERIFIED_FIX);
    });

    it('PM, комментирующий давно закрытую задачу, не «принимает работу»', () => {
      const context = buildContext({
        role: UserRole.PROJECT_MANAGER,
        taskRole: TaskRole.AUTHOR,
        activityStream: {
          issueState: GitLabIssueState.CLOSED,
          issueClosedOnReportDate: false,
          issueCommentsFromCurrentUser: 1,
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.COMMENTED);
    });

    it('разработчик-исполнитель не «закрывает задачу мерджем» задним числом', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        activityStream: {
          ...pushed(['feat: next step']),
          issueState: GitLabIssueState.CLOSED,
          mergeRequestState: GitLabMergeRequestState.MERGED,
          issueClosedOnReportDate: false,
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.WROTE_CODE);
    });
  });

  describe('контекст задачи не подменяет собственные действия PM', () => {
    it('свой возврат в разработку важнее прочего', () => {
      const context = buildContext({
        role: UserRole.PROJECT_MANAGER,
        taskRole: TaskRole.AUTHOR,
        labels: {
          qaFlags: [LabelQa.RETURNED_TO_DEVELOPMENT],
          qaFlagsSetByCurrentUser: [LabelQa.RETURNED_TO_DEVELOPMENT],
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.TASK_RETURNED_FROM_QA);
    });

    it('предоставление требований важнее того, что задача висит в QA', () => {
      const context = buildContext({
        role: UserRole.PROJECT_MANAGER,
        taskRole: TaskRole.AUTHOR,
        labels: {
          currentStatus: LabelStatus.NEED_INFORMATION,
          activeStatuses: [LabelStatus.QA_IN_PROGRESS],
        },
        activityStream: { issueCommentsFromCurrentUser: 2 },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.PROVIDED_REQUIREMENTS);
    });
  });

  describe('status::QA passed', () => {
    it('переход в «проверено» сегодня — заметный итог дня разработчика', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { currentStatus: LabelStatus.QA_PASSED },
        activityStream: pushed(['feat: unrelated']),
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.DEV_PASSED_QA);
    });

    it('давно висящий «проверено» не перебивает работу над кодом', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { activeStatuses: [LabelStatus.QA_PASSED] },
        activityStream: {
          ...pushed(['feat: unrelated']),
          mergeRequestState: GitLabMergeRequestState.OPENED,
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.WROTE_CODE);
    });

    it('без активной работы висящий «проверено» становится итогом по задаче', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { activeStatuses: [LabelStatus.QA_PASSED] },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.DEV_PASSED_QA);
    });
  });

  describe('треды ревью', () => {
    it('незакрытые треды — работа над замечаниями ещё идёт', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        activityStream: {
          ...pushed(['fix: review notes']),
          mergeRequestState: GitLabMergeRequestState.OPENED,
          reviewThreadCount: 3,
          unresolvedReviewThreadCount: 2,
        },
      });

      expect(resolver.resolve(context)).toBe(
        TaskStatus.RESOLVING_REVIEW_COMMENTS,
      );
    });

    it('все треды закрыты — замечания закрыты', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        activityStream: {
          ...pushed(['fix: review notes']),
          mergeRequestState: GitLabMergeRequestState.OPENED,
          reviewThreadCount: 3,
          unresolvedReviewThreadCount: 0,
        },
      });

      expect(resolver.resolve(context)).toBe(
        TaskStatus.RESOLVED_REVIEW_COMMENTS,
      );
    });

    it('без тредов и диалога правило не срабатывает', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        activityStream: {
          ...pushed(['feat: new code']),
          mergeRequestState: GitLabMergeRequestState.OPENED,
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.WROTE_CODE);
    });

    it('переписка в мр вне ревью — это обсуждение, а не работа по замечаниям', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        activityStream: {
          ...pushed(['feat: new code']),
          mergeRequestState: GitLabMergeRequestState.OPENED,
          mergeRequestCommentsFromCurrentUser: 1,
          mergeRequestCommentsFromOthers: 1,
        },
      });

      expect(resolver.resolve(context)).not.toBe(
        TaskStatus.RESOLVING_REVIEW_COMMENTS,
      );
      expect(resolver.resolve(context)).toBe(TaskStatus.WROTE_CODE);
    });

    it('та же переписка при задаче на ревью — работа по замечаниям', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        labels: { activeStatuses: [LabelStatus.REVIEW] },
        activityStream: {
          ...pushed(['feat: new code']),
          mergeRequestState: GitLabMergeRequestState.OPENED,
          mergeRequestCommentsFromCurrentUser: 1,
          mergeRequestCommentsFromOthers: 1,
        },
      });

      expect(resolver.resolve(context)).toBe(
        TaskStatus.RESOLVING_REVIEW_COMMENTS,
      );
    });

    it('треды важнее статуса: замечания закрыты даже вне статуса ревью', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        activityStream: {
          ...pushed(['fix: notes']),
          mergeRequestState: GitLabMergeRequestState.OPENED,
          reviewThreadCount: 2,
          unresolvedReviewThreadCount: 0,
        },
      });

      expect(resolver.resolve(context)).toBe(
        TaskStatus.RESOLVED_REVIEW_COMMENTS,
      );
    });

    it('тестировщик-проверяющий на задаче в статусе review проводит проверку', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskRole: TaskRole.REVIEWER,
        labels: { activeStatuses: [LabelStatus.REVIEW] },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.QA_IN_PROGRESS);
    });

    it('разработчик-ревьюер на той же задаче делает код-ревью', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        taskRole: TaskRole.REVIEWER,
        labels: { activeStatuses: [LabelStatus.REVIEW] },
        activityStream: { mergeRequestState: GitLabMergeRequestState.OPENED },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.STARTED_REVIEW);
    });
  });

  describe('создание задачи и проекта', () => {
    it('создание work item даёт «создал задачу», а не «создал проект»', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        taskRole: TaskRole.AUTHOR,
        activityStream: { issueActions: [GitLabAction.CREATED] },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.CREATED);
    });

    it('QA, создавший баг через work item, заводит баг-репорт', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskRole: TaskRole.OBSERVER,
        taskType: TaskType.BUG,
        activityStream: { issueActions: [GitLabAction.CREATED] },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.FOUND_BUG);
    });
  });

  describe('хотфиксы', () => {
    it('срочный мердж отдельного мр без задачи — хотфикс', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        isMergeRequestAuthor: true,
        labels: { priorities: [LabelPriority.CRITICAL] },
        activityStream: {
          mergeRequestState: GitLabMergeRequestState.MERGED,
          mergeRequestActions: [GitLabAction.ACCEPTED],
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.HOTFIX_DEPLOYED);
    });

    it('наличие type::bug не превращает хотфикс во что-то другое', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        taskType: TaskType.BUG,
        isMergeRequestAuthor: true,
        labels: {
          priorities: [LabelPriority.CRITICAL],
          types: [LabelType.BUG],
        },
        activityStream: {
          mergeRequestState: GitLabMergeRequestState.MERGED,
          mergeRequestActions: [GitLabAction.ACCEPTED],
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.HOTFIX_DEPLOYED);
    });

    it('лейбл type::hotfix даёт хотфикс и для задачи с мр', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        taskType: TaskType.HOTFIX,
        isMergeRequestAuthor: true,
        labels: { types: [LabelType.HOTFIX] },
        activityStream: {
          issueState: GitLabIssueState.OPENED,
          mergeRequestState: GitLabMergeRequestState.MERGED,
          mergeRequestActions: [GitLabAction.ACCEPTED],
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.HOTFIX_DEPLOYED);
    });

    it('критический баг с задачей — это исправление бага, а не деплой', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        taskType: TaskType.BUG,
        isMergeRequestAuthor: true,
        labels: { priorities: [LabelPriority.CRITICAL] },
        activityStream: {
          issueState: GitLabIssueState.OPENED,
          mergeRequestState: GitLabMergeRequestState.MERGED,
          mergeRequestActions: [GitLabAction.ACCEPTED],
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.FIXED_BUG);
    });
  });

  describe('одна задача, разные роли проверяющих', () => {
    //и разработчик, и тестировщик могут стоять ревьюерами в одной задаче:
    //глобальная роль решает, чем именно была их проверка
    const asReviewer = (role: UserRole, extra = {}) =>
      buildContext({
        role,
        taskRole: TaskRole.REVIEWER,
        labels: { activeStatuses: [LabelStatus.REVIEW] },
        activityStream: {
          mergeRequestState: GitLabMergeRequestState.OPENED,
          ...extra,
        },
      });

    it('без действий: разработчик — на ревью, тестировщик — на проверке', () => {
      expect(resolver.resolve(asReviewer(UserRole.DEVELOPER))).toBe(
        TaskStatus.STARTED_REVIEW,
      );
      expect(resolver.resolve(asReviewer(UserRole.QA))).toBe(
        TaskStatus.QA_IN_PROGRESS,
      );
    });

    it('после апрува: разработчик одобрил мр, тестировщик подтвердил корректность', () => {
      const approved = { currentUserApproved: true };
      expect(
        resolver.resolve(
          buildContext({
            role: UserRole.DEVELOPER,
            taskRole: TaskRole.REVIEWER,
            labels: { activeStatuses: [LabelStatus.REVIEW] },
            approvals: approved,
          }),
        ),
      ).toBe(TaskStatus.APPROVED_MR);

      expect(
        resolver.resolve(
          buildContext({
            role: UserRole.QA,
            taskRole: TaskRole.REVIEWER,
            labels: { activeStatuses: [LabelStatus.REVIEW] },
            approvals: approved,
          }),
        ),
      ).toBe(TaskStatus.TESTED_AND_APPROVED);
    });

    it('замечания без апрува: у разработчика — запрос доработок, у QA — тест с замечаниями', () => {
      const manyComments = { mergeRequestCommentsFromCurrentUser: 5 };
      expect(
        resolver.resolve(asReviewer(UserRole.DEVELOPER, manyComments)),
      ).toBe(TaskStatus.REQUESTED_CHANGES);
      expect(resolver.resolve(asReviewer(UserRole.QA, manyComments))).toBe(
        TaskStatus.TESTED_WITH_COMMENTS,
      );
    });
  });

  describe('регрессии существующих правил', () => {
    it('обычный мердж своей фичи не затронут новыми правилами', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        taskType: TaskType.FEATURE,
        isMergeRequestAuthor: true,
        activityStream: { mergeRequestActions: [GitLabAction.ACCEPTED] },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.IMPLEMENTED_FEATURE);
    });

    it('QA, эскалировавший критический баг на тестировании, блокирует релиз', () => {
      const context = buildContext({
        role: UserRole.QA,
        taskRole: TaskRole.OBSERVER,
        taskType: TaskType.BUG,
        labels: {
          currentStatus: LabelStatus.QA_IN_PROGRESS,
          priorities: [LabelPriority.CRITICAL],
          priorityChangedByCurrentUser: true,
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.BLOCKED_RELEASE);
    });

    it('возврат из QA-тестирования в doing считается возвратом на доработку', () => {
      const context = buildContext({
        role: UserRole.DEVELOPER,
        taskRole: TaskRole.REVIEWER,
        labels: {
          currentStatus: LabelStatus.DOING,
          previousStatus: LabelStatus.QA_IN_PROGRESS,
          statusLabelsSetByCurrentUser: [LabelStatus.DOING],
        },
      });

      expect(resolver.resolve(context)).toBe(TaskStatus.RETURNED_FOR_REVISION);
    });
  });
});
