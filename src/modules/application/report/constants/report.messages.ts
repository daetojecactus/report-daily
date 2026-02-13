import { TaskStatus } from '../../../../common/enums/task.enum';

export const TASK_STATUS_VERB: Record<TaskStatus, string> = {
  [TaskStatus.COMPLETED]: 'Завершил задачу',
  [TaskStatus.COMPLETED_BY_MERGE]: 'Закрыл задачу',
  [TaskStatus.FIXED_BUG]: 'Пофиксил баг',
  [TaskStatus.IMPLEMENTED_FEATURE]: 'Реализовал фичу',
  [TaskStatus.HOTFIX]: 'Выпустил хотфикс',
  [TaskStatus.URGENT_HOTFIX]: 'Выпустил срочный хотфикс',
  [TaskStatus.MERGED]: 'Смерджил',
  [TaskStatus.SENT_TO_REVIEW]: 'Отдал на ревью',
  [TaskStatus.ANSWERED_REVIEW]: 'Ответил на замечания',
  [TaskStatus.REVIEWED]: 'Провел ревью',
  [TaskStatus.CONTINUED_REVIEW]: 'Продолжил ревью',
  [TaskStatus.APPROVED]: 'Получил одобрение',
  [TaskStatus.APPROVED_AND_MERGED]: 'Апрувнул и смерджил',
  [TaskStatus.APPROVED_AFTER_REVIEW]: 'Принял после доработки',
  [TaskStatus.COMPLETED_CODE_REVIEW]: 'Завершил код-ревью',
  [TaskStatus.COMPLETED_TESTING]: 'Завершил тестирование',
  [TaskStatus.COMMENTED]: 'Оставил комментарий',
  [TaskStatus.STARTED]: 'Начал работу',
  [TaskStatus.CONTINUED]: 'Продолжил работу',
  [TaskStatus.CREATED]: 'Создал задачу',
  [TaskStatus.CREATED_PROJECT]: 'Создал проект',
  [TaskStatus.CREATED_REPO]: 'Создал репозиторий',
  [TaskStatus.NEED_INFORMATION]: 'Запросил уточнения',
  [TaskStatus.PASSED_TO_FRONTEND]: 'Передал на Frontend',
  [TaskStatus.RESUMED]: 'Вернулся к работе',
  [TaskStatus.UNKNOWN]: 'Работал над задачей',
};

export const ReportMessage = {
  NO_EVENTS: 'Нет событий за указанный период.',
  REPORT_HEADER: (date: string) => `Отчет за ${date}`,
  CONSOLE_HEADER: (date: string) => `\n——— ОТЧеТ ЗА ${date} ———\n`,
  DEFAULT_PROJECT_NAME: (id: number) => `Project_${id}`,
  DEFAULT_TASK_TITLE: (id: number) => `Задача #${id}`,
  HOTFIX_TITLE: 'Хотфикс',
} as const;
