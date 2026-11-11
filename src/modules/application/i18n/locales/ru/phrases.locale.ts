import { ActivityTier } from 'src/modules/application/report/activity/types/activity.enums';
import {
  PhraseContext,
  PhraseCount,
  PhraseName,
  ReportPhrase,
} from 'src/modules/application/report/phrase/types/phrase.enums';
import { WorkflowState } from 'src/modules/application/trait/types/trait.enums';
import type { PhrasesLocale } from '../../types/i18n-phrases.interface';

const PLURAL = new Intl.PluralRules('ru');

function count(value: number, one: string, few: string, many: string) {
  const form = PLURAL.select(value);
  return `${value} ${form === 'one' ? one : form === 'few' ? few : many}`;
}

function tasks(value: number) {
  return count(value, 'задачу', 'задачи', 'задач');
}

function toTasks(value: number) {
  return count(value, 'задаче', 'задачам', 'задачам');
}

export const ruPhrases: PhrasesLocale = {
  phrases: {
    actions: {
      [ReportPhrase.DEPENDENCIES_UPDATED]: {
        male: 'Обновил зависимости',
        female: 'Обновила зависимости',
      },
      [ReportPhrase.HOTFIX_RELEASED]: { male: 'Выпустил хотфикс', female: 'Выпустила хотфикс' },
      [ReportPhrase.E2E_DEVELOPED]: {
        male: 'Разработал E2E-покрытие',
        female: 'Разработала E2E-покрытие',
      },
      [ReportPhrase.AUTOTESTS_DEVELOPED]: {
        male: 'Разработал автотесты',
        female: 'Разработала автотесты',
      },
      [ReportPhrase.BUG_FIXED]: { male: 'Исправил баг', female: 'Исправила баг' },
      [ReportPhrase.INCIDENT_RESOLVED]: {
        male: 'Устранил инцидент',
        female: 'Устранила инцидент',
      },
      [ReportPhrase.FEATURE_IMPLEMENTED]: { male: 'Реализовал фичу', female: 'Реализовала фичу' },
      [ReportPhrase.IMPROVEMENT_DONE]: {
        male: 'Доработал функциональность',
        female: 'Доработала функциональность',
      },
      [ReportPhrase.TECH_DEBT_PAID]: {
        male: 'Устранил технический долг',
        female: 'Устранила технический долг',
      },
      [ReportPhrase.DOCUMENTATION_WRITTEN]: {
        male: 'Подготовил документацию',
        female: 'Подготовила документацию',
      },
      [ReportPhrase.RELEASE_PREPARED]: { male: 'Подготовил релиз', female: 'Подготовила релиз' },
      [ReportPhrase.MERGE_REQUEST_MERGED]: {
        male: 'Влил мердж-реквест',
        female: 'Влила мердж-реквест',
      },
      [ReportPhrase.APPROVED_AND_MERGED]: {
        male: 'Одобрил и смерджил',
        female: 'Одобрила и смерджила',
      },
      [ReportPhrase.DEPENDENCIES_MERGED]: {
        male: 'Влил обновление зависимостей',
        female: 'Влила обновление зависимостей',
      },
      [ReportPhrase.OTHERS_MERGED]: {
        male: 'Смерджил задачу коллеги',
        female: 'Смерджила задачу коллеги',
      },
      [ReportPhrase.MERGE_REQUEST_CLOSED]: {
        male: 'Закрыл мердж-реквест без вливания',
        female: 'Закрыла мердж-реквест без вливания',
      },
      [ReportPhrase.DUPLICATE_CLOSED]: {
        male: 'Закрыл задачу как дубликат',
        female: 'Закрыла задачу как дубликат',
      },
      [ReportPhrase.FIX_VERIFIED]: {
        male: 'Проверил исправление',
        female: 'Проверила исправление',
      },
      [ReportPhrase.CHECKED_AND_CLOSED]: {
        male: 'Проверил и закрыл задачу',
        female: 'Проверила и закрыла задачу',
      },
      [ReportPhrase.WORK_ACCEPTED]: {
        male: 'Принял выполненную работу',
        female: 'Приняла выполненную работу',
      },
      [ReportPhrase.CLOSED_WITHOUT_MERGE]: {
        male: 'Закрыл задачу без мерджа',
        female: 'Закрыла задачу без мерджа',
      },
      [ReportPhrase.TASK_CLOSED]: { male: 'Закрыл задачу', female: 'Закрыла задачу' },
      [ReportPhrase.MILESTONE_CLOSED]: { male: 'Закрыл веху', female: 'Закрыла веху' },
      [ReportPhrase.COMPLETED_BY_MERGE]: {
        male: 'Завершил задачу мерджем',
        female: 'Завершила задачу мерджем',
      },
      [ReportPhrase.TASK_COMPLETED]: { male: 'Завершил задачу', female: 'Завершила задачу' },
      [ReportPhrase.MILESTONE_REOPENED]: { male: 'Переоткрыл веху', female: 'Переоткрыла веху' },
      [ReportPhrase.BUG_REOPENED]: { male: 'Переоткрыл баг', female: 'Переоткрыла баг' },
      [ReportPhrase.TASK_REOPENED]: { male: 'Переоткрыл задачу', female: 'Переоткрыла задачу' },
      [ReportPhrase.VERSION_RELEASED]: { male: 'Выпустил версию', female: 'Выпустила версию' },
      [ReportPhrase.DEPENDENCIES_APPROVED]: {
        male: 'Одобрил обновление зависимостей',
        female: 'Одобрила обновление зависимостей',
      },
      [ReportPhrase.APPROVED_AFTER_REWORK]: {
        male: 'Подтвердил корректность после доработки',
        female: 'Подтвердила корректность после доработки',
      },
      [ReportPhrase.TESTED_AND_APPROVED]: {
        male: 'Протестировал и подтвердил корректность',
        female: 'Протестировала и подтвердила корректность',
      },
      [ReportPhrase.FIXES_ACCEPTED]: {
        male: 'Принял исправления',
        female: 'Приняла исправления',
      },
      [ReportPhrase.MERGE_REQUEST_APPROVED]: {
        male: 'Одобрил мердж-реквест',
        female: 'Одобрила мердж-реквест',
      },
      [ReportPhrase.APPROVAL_WITHDRAWN]: {
        male: 'Отозвал одобрение',
        female: 'Отозвала одобрение',
      },
      [ReportPhrase.TESTED_AND_RETURNED_WITH_REMARKS]: {
        male: 'Провёл тестирование, вернул с замечаниями',
        female: 'Провела тестирование, вернула с замечаниями',
      },
      [ReportPhrase.RETURNED_WITH_REMARKS]: {
        male: 'Вернул на доработку с замечаниями',
        female: 'Вернула на доработку с замечаниями',
      },
      [ReportPhrase.TESTED_AND_RETURNED]: {
        male: 'Провёл тестирование, вернул на доработку',
        female: 'Провела тестирование, вернула на доработку',
      },
      [ReportPhrase.RETURNED_TO_DEVELOPMENT]: {
        male: 'Вернул задачу в разработку',
        female: 'Вернула задачу в разработку',
      },
      [ReportPhrase.RETURNED_FOR_REWORK]: {
        male: 'Вернул на доработку',
        female: 'Вернула на доработку',
      },
      [ReportPhrase.PASSED_TESTING]: 'Задача прошла тестирование',
      [ReportPhrase.RELEASE_BLOCKED]: {
        male: 'Заблокировал релиз из-за бага',
        female: 'Заблокировала релиз из-за бага',
      },
      [ReportPhrase.TESTED_WITH_REMARKS]: {
        male: 'Провёл тестирование, оставил замечания',
        female: 'Провела тестирование, оставила замечания',
      },
      [ReportPhrase.CHANGES_REQUESTED]: {
        male: 'Запросил доработки по коду',
        female: 'Запросила доработки по коду',
      },
      [ReportPhrase.FIXES_CHECKED]: {
        male: 'Проверил исправления',
        female: 'Проверила исправления',
      },
      [ReportPhrase.CODE_REMARKS]: {
        male: 'Оставил замечания по коду',
        female: 'Оставила замечания по коду',
      },
      [ReportPhrase.REGRESSION_FOUND]: {
        male: 'Обнаружил регрессию',
        female: 'Обнаружила регрессию',
      },
      [ReportPhrase.BUG_FOUND]: { male: 'Обнаружил баг', female: 'Обнаружила баг' },
      [ReportPhrase.BUG_REPORTED]: { male: 'Завёл баг-репорт', female: 'Завела баг-репорт' },
      [ReportPhrase.BUG_FOUND_DURING_WORK]: {
        male: 'Обнаружил ошибку в ходе работы',
        female: 'Обнаружила ошибку в ходе работы',
      },
      [ReportPhrase.RESUBMITTED_TO_TESTING]: {
        male: 'Исправил замечания и вернул задачу на тестирование',
        female: 'Исправила замечания и вернула задачу на тестирование',
      },
      [ReportPhrase.FINISHED_AND_SENT_TO_REVIEW]: {
        male: 'Доработал и отправил на ревью',
        female: 'Доработала и отправила на ревью',
      },
      [ReportPhrase.FINISHED_AND_SENT_TO_TESTING]: {
        male: 'Доработал и передал задачу на тестирование',
        female: 'Доработала и передала задачу на тестирование',
      },
      [ReportPhrase.MOVED_TO_BACKLOG]: {
        male: 'Вернул задачу в бэклог',
        female: 'Вернула задачу в бэклог',
      },
      [ReportPhrase.PLANNED_FOR_SPRINT]: {
        male: 'Взял задачу в план спринта',
        female: 'Взяла задачу в план спринта',
      },
      [ReportPhrase.TAKEN_INTO_ANALYSIS]: {
        male: 'Взял задачу в анализ',
        female: 'Взяла задачу в анализ',
      },
      [ReportPhrase.SENT_TO_DESIGN]: {
        male: 'Передал задачу в дизайн',
        female: 'Передала задачу в дизайн',
      },
      [ReportPhrase.TAKEN_INTO_WORK]: {
        male: 'Взял задачу в работу',
        female: 'Взяла задачу в работу',
      },
      [ReportPhrase.SENT_TO_REVIEW]: { male: 'Отправил на ревью', female: 'Отправила на ревью' },
      [ReportPhrase.SENT_TO_TESTING]: {
        male: 'Передал задачу на тестирование',
        female: 'Передала задачу на тестирование',
      },
      [ReportPhrase.TESTING_TASK]: { male: 'Проверял задачу', female: 'Проверяла задачу' },
      [ReportPhrase.READY_FOR_RELEASE]: {
        male: 'Подготовил задачу к релизу',
        female: 'Подготовила задачу к релизу',
      },
      [ReportPhrase.DEPLOYED_TO_STAGING]: {
        male: 'Выложил задачу на стенд',
        female: 'Выложила задачу на стенд',
      },
      [ReportPhrase.MARKED_RELEASED]: {
        male: 'Отметил задачу выпущенной',
        female: 'Отметила задачу выпущенной',
      },
      [ReportPhrase.MARKED_DONE]: {
        male: 'Отметил задачу выполненной',
        female: 'Отметила задачу выполненной',
      },
      [ReportPhrase.TASK_CANCELLED]: { male: 'Отменил задачу', female: 'Отменила задачу' },
      [ReportPhrase.PUT_ON_HOLD]: { male: 'Отложил задачу', female: 'Отложила задачу' },
      [ReportPhrase.ASKED_FOR_DETAILS]: {
        male: 'Запросил уточнения по задаче',
        female: 'Запросила уточнения по задаче',
      },
      [ReportPhrase.HANDED_OFF]: {
        male: 'Передал задачу дальше',
        female: 'Передала задачу дальше',
      },
      [ReportPhrase.PRIORITY_RAISED]: {
        male: 'Повысил приоритет',
        female: 'Повысила приоритет',
      },
      [ReportPhrase.MERGE_SCHEDULED]: {
        male: 'Поставил мердж-реквест на автомерж',
        female: 'Поставила мердж-реквест на автомерж',
      },
      [ReportPhrase.TOOK_FOR_TESTING]: {
        male: 'Взял задачу на тестирование',
        female: 'Взяла задачу на тестирование',
      },
      [ReportPhrase.TOOK_FOR_REVIEW]: {
        male: 'Взял мердж-реквест на ревью',
        female: 'Взяла мердж-реквест на ревью',
      },
      [ReportPhrase.E2E_IN_PROGRESS]: {
        male: 'Разрабатывал E2E-покрытие',
        female: 'Разрабатывала E2E-покрытие',
      },
      [ReportPhrase.AUTOTESTS_MAINTAINED]: {
        male: 'Актуализировал автотесты',
        female: 'Актуализировала автотесты',
      },
      [ReportPhrase.AUTOTESTS_IN_PROGRESS]: {
        male: 'Разрабатывал автотесты',
        female: 'Разрабатывала автотесты',
      },
      [ReportPhrase.DEPENDENCIES_IN_PROGRESS]: {
        male: 'Работал над обновлением зависимостей',
        female: 'Работала над обновлением зависимостей',
      },
      [ReportPhrase.REVIEW_REMARKS_RESOLVED]: {
        male: 'Закрыл замечания по ревью',
        female: 'Закрыла замечания по ревью',
      },
      [ReportPhrase.FIXING_REVIEW_REMARKS]: {
        male: 'Исправлял замечания по ревью',
        female: 'Исправляла замечания по ревью',
      },
      [ReportPhrase.FIXING_TESTING_REMARKS]: {
        male: 'Исправлял замечания после тестирования',
        female: 'Исправляла замечания после тестирования',
      },
      [ReportPhrase.CONFLICTS_RESOLVED]: {
        male: 'Обновил ветку и разрешил конфликты',
        female: 'Обновила ветку и разрешила конфликты',
      },
      [ReportPhrase.TESTS_WRITTEN]: { male: 'Написал тесты', female: 'Написала тесты' },
      [ReportPhrase.IMPLEMENTATION_STARTED]: {
        male: 'Начал реализацию',
        female: 'Начала реализацию',
      },
      [ReportPhrase.WORK_STARTED]: { male: 'Начал работу', female: 'Начала работу' },
      [ReportPhrase.WORK_RESUMED]: {
        male: 'Возобновил работу над задачей',
        female: 'Возобновила работу над задачей',
      },
      [ReportPhrase.REFACTORED]: { male: 'Провёл рефакторинг', female: 'Провела рефакторинг' },
      [ReportPhrase.DRAFT_IN_PROGRESS]: {
        male: 'Продолжил работу над мердж-реквестом',
        female: 'Продолжила работу над мердж-реквестом',
      },
      [ReportPhrase.COMMITTED_TO_MAIN_BRANCH]: {
        male: 'Закоммитил в основную ветку',
        female: 'Закоммитила в основную ветку',
      },
      [ReportPhrase.PUSHED_TO_BRANCHES]: {
        male: 'Отправил изменения в',
        female: 'Отправила изменения в',
      },
      [ReportPhrase.CODE_WORK]: { male: 'Работал над кодом', female: 'Работала над кодом' },
      [ReportPhrase.REQUIREMENTS_AND_PLANNED]: {
        male: 'Уточнил требования и взял задачу в план',
        female: 'Уточнила требования и взяла задачу в план',
      },
      [ReportPhrase.REQUIREMENTS_AND_TAKEN_INTO_WORK]: {
        male: 'Уточнил требования и передал задачу в работу',
        female: 'Уточнила требования и передала задачу в работу',
      },
      [ReportPhrase.REQUIREMENTS_AFTER_DISCUSSION]: {
        male: 'Уточнил требования по итогам обсуждения',
        female: 'Уточнила требования по итогам обсуждения',
      },
      [ReportPhrase.DESCRIPTION_UPDATED]: {
        male: 'Обновил описание задачи',
        female: 'Обновила описание задачи',
      },
      [ReportPhrase.REQUIREMENTS_CLARIFIED]: {
        male: 'Уточнил требования',
        female: 'Уточнила требования',
      },
      [ReportPhrase.DECOMPOSED]: {
        male: 'Декомпозировал задачу',
        female: 'Декомпозировала задачу',
      },
      [ReportPhrase.DOCUMENTATION_PAGE_CREATED]: {
        male: 'Создал страницу документации',
        female: 'Создала страницу документации',
      },
      [ReportPhrase.DOCUMENTATION_UPDATED]: {
        male: 'Обновил документацию',
        female: 'Обновила документацию',
      },
      [ReportPhrase.MILESTONE_CREATED]: { male: 'Создал веху', female: 'Создала веху' },
      [ReportPhrase.MOVED_TO_ANOTHER_SPRINT]: {
        male: 'Перенёс задачу в',
        female: 'Перенесла задачу в',
      },
      [ReportPhrase.ADDED_TO_SPRINT]: { male: 'Взял задачу в', female: 'Взяла задачу в' },
      [ReportPhrase.MOVED_TO_ANOTHER_MILESTONE]: {
        male: 'Перенёс задачу в',
        female: 'Перенесла задачу в',
      },
      [ReportPhrase.ADDED_TO_MILESTONE]: {
        male: 'Запланировал задачу в',
        female: 'Запланировала задачу в',
      },
      [ReportPhrase.DUE_DATE_SET]: {
        male: 'Назначил срок задачи',
        female: 'Назначила срок задачи',
      },
      [ReportPhrase.START_DATE_SET]: {
        male: 'Назначил дату начала задачи',
        female: 'Назначила дату начала задачи',
      },
      [ReportPhrase.TASK_PLANNED]: {
        male: 'Запланировал задачу',
        female: 'Запланировала задачу',
      },
      [ReportPhrase.TAGS_PUSHED]: { male: 'Отправил теги', female: 'Отправила теги' },
      [ReportPhrase.TAG_CREATED]: { male: 'Поставил тег', female: 'Поставила тег' },
      [ReportPhrase.TECH_DEBT_RECORDED]: {
        male: 'Зафиксировал технический долг',
        female: 'Зафиксировала технический долг',
      },
      [ReportPhrase.FEATURE_PLANNED]: {
        male: 'Запланировал фичу',
        female: 'Запланировала фичу',
      },
      [ReportPhrase.TASK_CREATED]: { male: 'Создал задачу', female: 'Создала задачу' },
      [ReportPhrase.MOVED_FROM_PROJECT]: {
        male: 'Перенёс задачу из',
        female: 'Перенесла задачу из',
      },
      [ReportPhrase.DUPLICATE_MARKED]: {
        male: 'Отметил дубликат',
        female: 'Отметила дубликат',
      },
      [ReportPhrase.BLOCKER_MARKED]: {
        male: 'Отметил блокирующую задачу',
        female: 'Отметила блокирующую задачу',
      },
      [ReportPhrase.PARENT_SET]: {
        male: 'Указал родительскую задачу',
        female: 'Указала родительскую задачу',
      },
      [ReportPhrase.TASKS_LINKED]: { male: 'Связал задачи', female: 'Связала задачи' },
      [ReportPhrase.SOLUTION_DISCUSSED]: {
        male: 'Обсуждал техническое решение',
        female: 'Обсуждала техническое решение',
      },
      [ReportPhrase.HELPED_FIX_BUG]: {
        male: 'Помог с исправлением бага',
        female: 'Помогла с исправлением бага',
      },
      [ReportPhrase.HELPED_WITH_TASK]: { male: 'Помог с задачей', female: 'Помогла с задачей' },
      [ReportPhrase.ASSIGNEE_REMOVED]: {
        male: 'Снял исполнителя',
        female: 'Сняла исполнителя',
      },
      [ReportPhrase.TASK_ASSIGNED]: {
        male: 'Назначил задачу в работу',
        female: 'Назначила задачу в работу',
      },
      [ReportPhrase.ESTIMATE_CHANGED]: {
        male: 'Изменил оценку задачи',
        female: 'Изменила оценку задачи',
      },
      [ReportPhrase.TASK_ESTIMATED]: { male: 'Оценил задачу', female: 'Оценила задачу' },
      [ReportPhrase.TASK_RENAMED]: {
        male: 'Переименовал задачу',
        female: 'Переименовала задачу',
      },
      [ReportPhrase.DESCRIPTION_EDITED]: {
        male: 'Обновил описание',
        female: 'Обновила описание',
      },
      [ReportPhrase.LABELS_UPDATED]: { male: 'Обновил лейблы', female: 'Обновила лейблы' },
      [ReportPhrase.STATUS_UPDATED]: { male: 'Обновил статус', female: 'Обновила статус' },
      [ReportPhrase.MARKED_DRAFT]: {
        male: 'Перевёл мердж-реквест в черновик',
        female: 'Перевела мердж-реквест в черновик',
      },
      [ReportPhrase.REVIEWERS_CHANGED]: {
        male: 'Изменил ревьюеров',
        female: 'Изменила ревьюеров',
      },
      [ReportPhrase.REMOVED_FROM_SPRINT]: {
        male: 'Убрал задачу из спринта',
        female: 'Убрала задачу из спринта',
      },
      [ReportPhrase.REMOVED_FROM_MILESTONE]: {
        male: 'Убрал задачу из вехи',
        female: 'Убрала задачу из вехи',
      },
      [ReportPhrase.ESTIMATE_REMOVED]: {
        male: 'Снял оценку задачи',
        female: 'Сняла оценку задачи',
      },
      [ReportPhrase.LINK_REMOVED]: { male: 'Убрал связь задач', female: 'Убрала связь задач' },
      [ReportPhrase.DUE_DATE_REMOVED]: {
        male: 'Убрал срок задачи',
        female: 'Убрала срок задачи',
      },
      [ReportPhrase.START_DATE_REMOVED]: {
        male: 'Убрал дату начала задачи',
        female: 'Убрала дату начала задачи',
      },
      [ReportPhrase.AUTO_MERGE_CANCELLED]: {
        male: 'Отменил автомерж',
        female: 'Отменила автомерж',
      },
      [ReportPhrase.TASK_UPDATED]: { male: 'Обновил задачу', female: 'Обновила задачу' },
      [ReportPhrase.TAG_DELETED]: { male: 'Удалил тег', female: 'Удалила тег' },
      [ReportPhrase.DOCUMENTATION_PAGE_DELETED]: {
        male: 'Удалил страницу документации',
        female: 'Удалила страницу документации',
      },
      [ReportPhrase.MILESTONE_DELETED]: { male: 'Удалил веху', female: 'Удалила веху' },
      [ReportPhrase.BRANCHES_DELETED]: { male: 'Удалил ветки', female: 'Удалила ветки' },
      [ReportPhrase.BRANCH_DELETED]: { male: 'Удалил ветку', female: 'Удалила ветку' },
      [ReportPhrase.BUG_DETAILS_CLARIFIED]: {
        male: 'Уточнил детали бага',
        female: 'Уточнила детали бага',
      },
      [ReportPhrase.COMMENTED]: { male: 'Оставил комментарий', female: 'Оставила комментарий' },
      [ReportPhrase.WORKED_ON_TASK]: {
        male: 'Работал над задачей',
        female: 'Работала над задачей',
      },
    },
    contexts: {
      [PhraseContext.AFTER_TESTING]: 'после тестирования',
      [PhraseContext.AFTER_REWORK]: 'после доработки',
      [PhraseContext.AFTER_APPROVAL]: 'после одобрения',
      [PhraseContext.AFTER_REVIEW]: 'после ревью',
      [PhraseContext.AUTO_MERGE]: 'через автомерж',
    },
    states: {
      [WorkflowState.BACKLOG]: 'в бэклоге',
      [WorkflowState.PLANNED]: 'в плане',
      [WorkflowState.ANALYSIS]: 'на анализе',
      [WorkflowState.DESIGN]: 'в дизайне',
      [WorkflowState.IN_PROGRESS]: 'в работе',
      [WorkflowState.REVIEW]: 'на ревью',
      [WorkflowState.CHANGES_REQUESTED]: 'на доработке после ревью',
      [WorkflowState.READY_FOR_QA]: 'ждёт тестирования',
      [WorkflowState.TESTING]: 'на тестировании',
      [WorkflowState.QA_PASSED]: 'прошла тестирование',
      [WorkflowState.READY_FOR_RELEASE]: 'готова к релизу',
      [WorkflowState.STAGING]: 'на стенде',
      [WorkflowState.RELEASED]: 'выпущена',
      [WorkflowState.DONE]: 'выполнена',
      [WorkflowState.CANCELLED]: 'отменена',
      [WorkflowState.BLOCKED]: 'отложена',
      [WorkflowState.NEEDS_INFO]: 'ждёт информации',
      [WorkflowState.HANDOFF]: 'передана дальше',
    },
    closed: 'закрыта',
    stateLine: (state) => `Задача ${state}`,
    stateNote: (state) => `задача ${state}`,
    quote: (title) => `«${title}»`,
    withNote: (text, note) => `${text} · ${note}`,
    names: {
      [PhraseName.SPRINT]: (name) => (name ? ` спринт ${name}` : ' спринт'),
      [PhraseName.OTHER_SPRINT]: (name) => (name ? ` спринт ${name}` : ' другой спринт'),
      [PhraseName.MILESTONE]: (name) => (name ? ` веху ${name}` : ' веху'),
      [PhraseName.OTHER_MILESTONE]: (name) => (name ? ` веху ${name}` : ' другую веху'),
      [PhraseName.DATE]: (name) => (name ? ` на ${name}` : ''),
      [PhraseName.PROJECT]: (name) => (name ? ` проекта ${name}` : ' другого проекта'),
    },
    counts: {
      [PhraseCount.SUBTASKS]: (value) =>
        value ? ` на ${count(value, 'подзадачу', 'подзадачи', 'подзадач')}` : '',
      [PhraseCount.BRANCHES]: (value) =>
        value ? ` ${count(value, 'ветку', 'ветки', 'веток')}` : ' несколько веток',
      [PhraseCount.REFS]: (value) => (value ? `: ${value}` : ''),
    },
    summaries: {
      [ReportPhrase.MILESTONE_CREATED]: (value) => ({
        male: `Создал ${count(value, 'веху', 'вехи', 'вех')}`,
        female: `Создала ${count(value, 'веху', 'вехи', 'вех')}`,
      }),
      [ReportPhrase.MOVED_TO_ANOTHER_SPRINT]: (value) => ({
        male: `Перенёс ${tasks(value)} в`,
        female: `Перенесла ${tasks(value)} в`,
      }),
      [ReportPhrase.ADDED_TO_SPRINT]: (value) => ({
        male: `Взял ${tasks(value)} в`,
        female: `Взяла ${tasks(value)} в`,
      }),
      [ReportPhrase.MOVED_TO_ANOTHER_MILESTONE]: (value) => ({
        male: `Перенёс ${tasks(value)} в`,
        female: `Перенесла ${tasks(value)} в`,
      }),
      [ReportPhrase.ADDED_TO_MILESTONE]: (value) => ({
        male: `Запланировал ${tasks(value)} в`,
        female: `Запланировала ${tasks(value)} в`,
      }),
      [ReportPhrase.DUE_DATE_SET]: (value) => ({
        male: `Назначил срок ${toTasks(value)}`,
        female: `Назначила срок ${toTasks(value)}`,
      }),
      [ReportPhrase.START_DATE_SET]: (value) => ({
        male: `Назначил дату начала ${toTasks(value)}`,
        female: `Назначила дату начала ${toTasks(value)}`,
      }),
      [ReportPhrase.TASK_PLANNED]: (value) => ({
        male: `Запланировал ${tasks(value)}`,
        female: `Запланировала ${tasks(value)}`,
      }),
      [ReportPhrase.ESTIMATE_CHANGED]: (value) => ({
        male: `Переоценил ${tasks(value)}`,
        female: `Переоценила ${tasks(value)}`,
      }),
      [ReportPhrase.TASK_ESTIMATED]: (value) => ({
        male: `Оценил ${tasks(value)}`,
        female: `Оценила ${tasks(value)}`,
      }),
      [ReportPhrase.MOVED_FROM_PROJECT]: (value) => ({
        male: `Перенёс ${tasks(value)} из других проектов`,
        female: `Перенесла ${tasks(value)} из других проектов`,
      }),
    },
    summaryLine: (text, references) => `${text}: ${references}`,
    dateLocale: 'ru',
    categories: {
      [ActivityTier.OUTCOME]: 'Итоги',
      [ActivityTier.CHECK]: 'Проверки',
      [ActivityTier.TRANSITION]: 'Переходы',
      [ActivityTier.WORK]: 'Работа',
      [ActivityTier.PARTICIPATION]: 'Участие',
      [ActivityTier.CONTEXT]: 'Состояние задач',
    },
  },
};
