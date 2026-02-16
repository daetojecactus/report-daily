import { TaskStatus } from '../../../../common/enums/task.enum';

export interface Gendered {
  male: string;
  female: string;
}

export const REPORT_TASK_ACTIONS: Record<TaskStatus, Gendered> = {
  //QA
  [TaskStatus.FOUND_BUG]: { male: 'Нашел баг', female: 'Нашла баг' },
  [TaskStatus.CREATED_TASK]: {
    male: 'Создал задачу',
    female: 'Создала задачу',
  },
  [TaskStatus.VERIFIED_FIX]: {
    male: 'Принял исправление',
    female: 'Приняла исправление',
  },
  [TaskStatus.RETURNED_FOR_REVISION]: {
    male: 'Вернул на доработку',
    female: 'Вернула на доработку',
  },
  [TaskStatus.CLARIFIED_BUG]: {
    male: 'Уточнил детали бага',
    female: 'Уточнила детали бага',
  },
  [TaskStatus.STARTED_TESTING]: {
    male: 'Начал тестирование',
    female: 'Начала тестирование',
  },
  [TaskStatus.TESTED_AND_APPROVED]: {
    male: 'Протестировал и апрувнул',
    female: 'Протестировала и апрувнула',
  },
  [TaskStatus.TESTED_WITH_COMMENTS]: {
    male: 'Провел тестирование и оставил замечания',
    female: 'Провела тестирование и оставила замечания',
  },
  [TaskStatus.APPROVED_AFTER_REWORK]: {
    male: 'Апрувнул после доработок',
    female: 'Апрувнула после доработок',
  },
  [TaskStatus.WROTE_TESTS]: { male: 'Писал тесты', female: 'Писала тесты' },

  //PM
  [TaskStatus.PLANNED_FEATURE]: {
    male: 'Запланировал фичу',
    female: 'Запланировала фичу',
  },
  [TaskStatus.REPORTED_BUG]: {
    male: 'Сообщил о баге',
    female: 'Сообщила о баге',
  },
  [TaskStatus.ACCEPTED_WORK]: {
    male: 'Принял работу',
    female: 'Приняла работу',
  },
  [TaskStatus.PROVIDED_REQUIREMENTS]: {
    male: 'Предоставил требования',
    female: 'Предоставила требования',
  },
  [TaskStatus.REQUESTED_STATUS]: {
    male: 'Запросил статус',
    female: 'Запросила статус',
  },
  [TaskStatus.ESCALATED_PRIORITY]: {
    male: 'Повысил приоритет',
    female: 'Повысила приоритет',
  },

  //Developer (Assignee)
  [TaskStatus.HOTFIX_DEPLOYED]: {
    male: 'Выпустил хотфикс',
    female: 'Выпустила хотфикс',
  },
  [TaskStatus.FIXED_BUG]: { male: 'Пофиксил баг', female: 'Пофиксила баг' },
  [TaskStatus.IMPLEMENTED_FEATURE]: {
    male: 'Реализовал фичу',
    female: 'Реализовала фичу',
  },
  [TaskStatus.COMPLETED_BY_MERGE]: {
    male: 'Закрыл задачу',
    female: 'Закрыла задачу',
  },
  [TaskStatus.SENT_TO_REVIEW]: {
    male: 'Отдал на ревью',
    female: 'Отдала на ревью',
  },
  [TaskStatus.PASSED_REVIEW]: {
    male: 'Прошёл ревью',
    female: 'Прошла ревью',
  },
  [TaskStatus.NEED_INFORMATION]: {
    male: 'Запросил информацию',
    female: 'Запросила информацию',
  },
  [TaskStatus.PASSED_TO_FRONTEND]: {
    male: 'Передал на Frontend',
    female: 'Передала на Frontend',
  },
  [TaskStatus.CORRECTED_AFTER_REVIEW]: {
    male: 'Исправил по замечаниям',
    female: 'Исправила по замечаниям',
  },
  [TaskStatus.STARTED_IMPLEMENTATION]: {
    male: 'Начал реализацию',
    female: 'Начала реализацию',
  },
  [TaskStatus.WROTE_CODE]: { male: 'Писал код', female: 'Писала код' },
  [TaskStatus.DISCUSSED_CODE]: {
    male: 'Обсуждал решение',
    female: 'Обсуждала решение',
  },

  //Developer (Reviewer)
  [TaskStatus.APPROVED_FIXES]: {
    male: 'Принял правки',
    female: 'Приняла правки',
  },
  [TaskStatus.APPROVED_MR]: { male: 'Одобрил МР', female: 'Одобрила МР' },
  [TaskStatus.REQUESTED_CHANGES]: {
    male: 'Запросил изменения',
    female: 'Запросила изменения',
  },
  [TaskStatus.REVIEW_COMMENT]: {
    male: 'Задал вопросы по коду',
    female: 'Задала вопросы по коду',
  },
  [TaskStatus.MERGED_OTHERS_WORK]: {
    male: 'Смерджил чужую задачу',
    female: 'Смерджила чужую задачу',
  },

  //Developer (Author)
  [TaskStatus.CREATED_TECH_DEBT]: {
    male: 'Завел тех. долг',
    female: 'Завела тех. долг',
  },
  [TaskStatus.FOUND_BUG_DURING_WORK]: {
    male: 'Нашел баг при работе',
    female: 'Нашла баг при работе',
  },
  [TaskStatus.ACCEPTED_RESULT]: {
    male: 'Принял результат',
    female: 'Приняла результат',
  },

  //Общие
  [TaskStatus.COMMENTED]: {
    male: 'Оставил комментарий',
    female: 'Оставила комментарий',
  },
  [TaskStatus.STARTED]: { male: 'Начал работу', female: 'Начала работу' },
  [TaskStatus.CONTINUED]: {
    male: 'Продолжил работу',
    female: 'Продолжила работу',
  },
  [TaskStatus.CREATED]: { male: 'Создал задачу', female: 'Создала задачу' },
  [TaskStatus.CREATED_PROJECT]: {
    male: 'Создал проект',
    female: 'Создала проект',
  },
  [TaskStatus.CREATED_REPO]: {
    male: 'Создал репозиторий',
    female: 'Создала репозиторий',
  },
  [TaskStatus.UNKNOWN]: {
    male: 'Работал над задачей',
    female: 'Работала над задачей',
  },
};
