import { TaskStatus } from '../enums/task.enum';
import { UserGender, UserRole } from 'src/modules/application/user/user.enums';
import { getReportTaskAction } from '../helpers/get-report-task-action.helper';
import { getRoleLabel } from './entity-labels';
import { Language, getLocale } from './i18n';

const ALL_STATUSES = Object.values(TaskStatus);
const LANGUAGES = Object.values(Language);

describe('i18n', () => {
  it.each(LANGUAGES)('в локали %s переведены все статусы задач', (language) => {
    const locale = getLocale(language);

    for (const status of ALL_STATUSES) {
      expect(locale.taskActions[status]?.male).toBeTruthy();
      expect(locale.taskActions[status]?.female).toBeTruthy();
    }
  });

  it('все русские формулировки имеют разные формы для мужского и женского рода', () => {
    const locale = getLocale(Language.RU);
    const sameForBothGenders = ALL_STATUSES.filter(
      (status) =>
        locale.taskActions[status].male === locale.taskActions[status].female,
    );

    expect(sameForBothGenders).toEqual([]);
  });

  it.each(LANGUAGES)(
    'в локали %s нет двух статусов с одинаковой формулировкой',
    (language) => {
      const locale = getLocale(language);
      const byText = new Map<string, TaskStatus[]>();

      for (const status of ALL_STATUSES) {
        const text = locale.taskActions[status].male;
        byText.set(text, [...(byText.get(text) ?? []), status]);
      }

      const duplicates = [...byText.entries()].filter(
        ([, statuses]) => statuses.length > 1,
      );

      expect(duplicates).toEqual([]);
    },
  );

  it('русские формулировки различаются по полу', () => {
    const locale = getLocale(Language.RU);
    const genderedStatuses = [
      TaskStatus.TASK_SENT_TO_QA,
      TaskStatus.DEV_FIXING_AFTER_QA,
      TaskStatus.DEV_RESUBMITTED_TO_QA,
      TaskStatus.QA_IN_PROGRESS,
      TaskStatus.QA_RETURNED_TO_DEV,
      TaskStatus.QA_AUTOMATION_DEVELOPED,
      TaskStatus.QA_E2E_COVERAGE_ADDED,
      TaskStatus.TASK_SENT_TO_QA,
      TaskStatus.TASK_RETURNED_FROM_QA,
    ];

    for (const status of genderedStatuses) {
      const action = locale.taskActions[status];
      expect(action.male).not.toBe(action.female);
    }
  });

  it('подставляет форму по полу пользователя', () => {
    expect(
      getReportTaskAction(
        TaskStatus.TASK_SENT_TO_QA,
        UserGender.MALE,
        Language.RU,
      ),
    ).toBe('Передал задачу на тестирование');
    expect(
      getReportTaskAction(
        TaskStatus.TASK_SENT_TO_QA,
        UserGender.FEMALE,
        Language.RU,
      ),
    ).toBe('Передала задачу на тестирование');
    expect(
      getReportTaskAction(
        TaskStatus.QA_RETURNED_TO_DEV,
        UserGender.FEMALE,
        Language.EN,
      ),
    ).toBe('Returned the task to development');
  });

  it.each(LANGUAGES)(
    'в локали %s переведены все роли пользователей',
    (language) => {
      const locale = getLocale(language);

      for (const role of Object.values(UserRole)) {
        expect(locale.entities.userRole[role]).toBeTruthy();
      }
    },
  );

  it('роль системного аналитика локализована', () => {
    expect(getRoleLabel(UserRole.SYSTEM_ANALYST, getLocale(Language.RU))).toBe(
      'Системный аналитик',
    );
  });
});
