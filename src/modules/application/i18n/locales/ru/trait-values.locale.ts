import {
  TraitDimension,
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/trait.enums';
import type { TraitsLocale } from '../../i18n.interface';

export const ruTraitValues: TraitsLocale['traits'] = {
  dimensions: {
    [TraitDimension.WORKFLOW_STATE]: 'Состояние',
    [TraitDimension.TASK_KIND]: 'Тип задачи',
    [TraitDimension.PRIORITY]: 'Приоритет',
    [TraitDimension.SEVERITY]: 'Серьёзность',
    [TraitDimension.AREA]: 'Область',
    [TraitDimension.FLAG]: 'Флаг',
  },
  values: {
    [TraitDimension.WORKFLOW_STATE]: {
      [WorkflowState.BACKLOG]: {
        name: 'Бэклог',
        description: 'Заведена, но не запланирована',
      },
      [WorkflowState.PLANNED]: {
        name: 'Запланировано',
        description: 'Взята в план и ждёт начала',
      },
      [WorkflowState.ANALYSIS]: {
        name: 'Анализ',
        description: 'Требования, проработка, декомпозиция',
      },
      [WorkflowState.DESIGN]: {
        name: 'Дизайн',
        description: 'Макеты, UX, проверка решения',
      },
      [WorkflowState.IN_PROGRESS]: {
        name: 'В работе',
        description: 'Идёт разработка',
      },
      [WorkflowState.REVIEW]: {
        name: 'На ревью',
        description: 'Ждёт или проходит code review',
      },
      [WorkflowState.CHANGES_REQUESTED]: {
        name: 'Доработка после ревью',
        description: 'Ревьюер попросил правки',
      },
      [WorkflowState.READY_FOR_QA]: {
        name: 'Готово к тестированию',
        description: 'Разработка закончена, ждёт QA',
      },
      [WorkflowState.TESTING]: {
        name: 'Тестирование',
        description: 'QA проверяет',
      },
      [WorkflowState.QA_PASSED]: {
        name: 'Проверено',
        description: 'QA подтвердил',
      },
      [WorkflowState.READY_FOR_RELEASE]: {
        name: 'Готово к релизу',
        description: 'Принято, ждёт выкладки',
      },
      [WorkflowState.STAGING]: {
        name: 'На стенде',
        description: 'Выложено на стенд или стейджинг',
      },
      [WorkflowState.RELEASED]: {
        name: 'Выпущено',
        description: 'В продакшене, в том числе под фичефлагом',
      },
      [WorkflowState.DONE]: {
        name: 'Готово',
        description: 'Работа завершена',
      },
      [WorkflowState.CANCELLED]: {
        name: 'Отменено',
        description: 'Не будет сделано: дубль, неактуально, не воспроизводится',
      },
      [WorkflowState.BLOCKED]: {
        name: 'Заблокировано',
        description: 'Отложено или ждёт внешнего',
      },
      [WorkflowState.NEEDS_INFO]: {
        name: 'Нужна информация',
        description: 'Ждёт уточнений',
      },
      [WorkflowState.HANDOFF]: {
        name: 'Передано',
        description: 'Передано другой части команды',
      },
    },
    [TraitDimension.TASK_KIND]: {
      [TaskKind.HOTFIX]: {
        name: 'Хотфикс',
        description: 'Срочное исправление на проде',
      },
      [TaskKind.INCIDENT]: {
        name: 'Инцидент',
        description: 'Сбой в работе системы',
      },
      [TaskKind.BUG]: { name: 'Баг', description: 'Ошибка в работе' },
      [TaskKind.FEATURE]: { name: 'Фича', description: 'Новая возможность' },
      [TaskKind.IMPROVEMENT]: {
        name: 'Улучшение',
        description: 'Доработка существующего',
      },
      [TaskKind.MAINTENANCE]: {
        name: 'Техдолг',
        description: 'Рефакторинг, чистка, обслуживание',
      },
      [TaskKind.DEPENDENCY]: {
        name: 'Зависимости',
        description: 'Обновление библиотек и зависимостей',
      },
      [TaskKind.EPIC]: {
        name: 'Эпик',
        description: 'Крупная задача с подзадачами',
      },
      [TaskKind.QA_INTERNAL]: {
        name: 'Задача QA',
        description: 'Тест-планы, тестовые данные, инструменты QA',
      },
      [TaskKind.TEST_AUTOMATION]: {
        name: 'Автотесты',
        description: 'Написание и починка автотестов',
      },
      [TaskKind.DOCUMENTATION]: {
        name: 'Документация',
        description: 'Тексты, справка, README',
      },
      [TaskKind.REQUIREMENTS]: {
        name: 'Требования',
        description: 'Постановка, ТЗ, спецификация',
      },
      [TaskKind.RESEARCH]: {
        name: 'Исследование',
        description: 'Spike, прототип, сравнение вариантов',
      },
      [TaskKind.SUPPORT]: {
        name: 'Поддержка',
        description: 'Вопрос или обращение пользователя',
      },
      [TaskKind.RELEASE]: {
        name: 'Релиз',
        description: 'Подготовка и проведение релиза',
      },
      [TaskKind.TASK]: {
        name: 'Задача',
        description: 'Обычная задача без особого типа',
      },
    },
    [TraitDimension.PRIORITY]: {
      [Priority.CRITICAL]: {
        name: 'Критический',
        description: 'Нужно прямо сейчас',
      },
      [Priority.HIGH]: { name: 'Высокий', description: 'Нужно скоро' },
      [Priority.MEDIUM]: { name: 'Средний', description: 'По плану' },
      [Priority.LOW]: { name: 'Низкий', description: 'Когда будет время' },
    },
    [TraitDimension.SEVERITY]: {
      [Severity.BLOCKER]: {
        name: 'S1 — блокирующая',
        description: 'Работа невозможна, обхода нет',
      },
      [Severity.CRITICAL]: {
        name: 'S2 — критичная',
        description: 'Важная функция не работает',
      },
      [Severity.MAJOR]: {
        name: 'S3 — значительная',
        description: 'Работает с ошибками, есть обход',
      },
      [Severity.MINOR]: {
        name: 'S4 — незначительная',
        description: 'Косметика, мелочи',
      },
    },
    [TraitDimension.AREA]: {
      [TaskArea.FRONTEND]: { name: 'Фронтенд', description: 'Веб-интерфейс' },
      [TaskArea.BACKEND]: { name: 'Бэкенд', description: 'Серверная логика' },
      [TaskArea.MOBILE]: {
        name: 'Мобильное приложение',
        description: 'iOS и Android',
      },
      [TaskArea.API]: {
        name: 'API',
        description: 'Внешние и внутренние API, интеграции',
      },
      [TaskArea.DATABASE]: {
        name: 'База данных',
        description: 'Схема, миграции, запросы, индексы',
      },
      [TaskArea.DATA]: {
        name: 'Данные и аналитика',
        description: 'DWH, ETL, BI, отчёты, дашборды',
      },
      [TaskArea.INFRASTRUCTURE]: {
        name: 'Инфраструктура',
        description: 'Серверы, облако, сети, Kubernetes, мониторинг',
      },
      [TaskArea.CI_CD]: {
        name: 'CI/CD',
        description: 'Сборки, пайплайны, деплой',
      },
      [TaskArea.SECURITY]: {
        name: 'Безопасность',
        description: 'Уязвимости, доступы, сертификаты',
      },
      [TaskArea.PERFORMANCE]: {
        name: 'Производительность',
        description: 'Скорость, нагрузка, масштабирование',
      },
      [TaskArea.ACCESSIBILITY]: {
        name: 'Доступность',
        description: 'Удобство для людей с ограничениями',
      },
      [TaskArea.DESIGN]: {
        name: 'Дизайн и UX',
        description: 'Макеты, удобство, юзабилити',
      },
    },
    [TraitDimension.FLAG]: {
      [TaskFlag.EXCLUDE_FROM_REPORT]: {
        name: 'Не в отчёт',
        description: 'Задача не попадает в отчёт',
      },
      [TaskFlag.RETURNED_FROM_QA]: {
        name: 'Вернули из тестирования',
        description: 'QA вернул задачу на доработку',
      },
      [TaskFlag.E2E_REQUIRED]: {
        name: 'Нужны e2e-тесты',
        description: 'Задачу нужно покрыть e2e-тестами',
      },
      [TaskFlag.UNIT_TESTS_REQUIRED]: {
        name: 'Нужны юнит-тесты',
        description: 'Задаче нужны юнит-тесты',
      },
      [TaskFlag.NEEDS_REBASE]: {
        name: 'Нужен rebase',
        description: 'Ветка отстала от основной',
      },
      [TaskFlag.REGRESSION]: {
        name: 'Регрессия',
        description: 'Сломалось то, что работало',
      },
      [TaskFlag.FLAKY_TEST]: {
        name: 'Нестабильный тест',
        description: 'Тест то проходит, то падает',
      },
      [TaskFlag.DRAFT]: {
        name: 'Черновик',
        description: 'MR ещё не готов к слиянию',
      },
      [TaskFlag.BREAKING_CHANGE]: {
        name: 'Ломает совместимость',
        description: 'Несовместимое изменение',
      },
      [TaskFlag.CUSTOMER_REQUEST]: {
        name: 'Запрос клиента',
        description: 'Задача от клиента или заказчика',
      },
    },
  },
};
