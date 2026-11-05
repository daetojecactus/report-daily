import { Channel } from 'src/common/enums/channel.enums';
import { BotCommand } from 'src/modules/application/bot/bot.enums';
import {
  TraitDimension,
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/trait.enums';
import {
  Gender,
  JobRole,
  Permission,
  UserStatus,
} from 'src/modules/application/user/user.enums';
import { Source } from 'src/modules/application/source/source.enums';
import { Language } from '../i18n.enums';
import type { Locale } from '../i18n.interface';

export const ru: Locale = {
  channels: {
    [Channel.TELEGRAM]: 'Telegram',
    [Channel.SLACK]: 'Slack',
  },
  sources: {
    [Source.GITLAB]: 'GitLab',
  },
  languages: {
    [Language.RU]: 'Русский',
    [Language.EN]: 'English',
  },
  commands: {
    [BotCommand.START]: 'Начать работу с ботом',
    [BotCommand.SETTINGS]: 'Мои настройки',
    [BotCommand.ADMIN]: 'Управление ботом',
    [BotCommand.HELP]: 'Список команд',
    [BotCommand.CANCEL]: 'Прервать текущее действие',
  },
  roles: {
    [JobRole.DEVELOPER]: 'Разработчик',
    [JobRole.QA]: 'QA',
    [JobRole.PROJECT_MANAGER]: 'Проектный менеджер',
    [JobRole.SYSTEM_ANALYST]: 'Системный аналитик',
    [JobRole.DEVOPS]: 'DevOps',
  },
  genders: {
    [Gender.MALE]: 'мужской',
    [Gender.FEMALE]: 'женский',
  },
  statuses: {
    [UserStatus.PENDING]: 'ждёт подключения',
    [UserStatus.ACTIVE]: 'работает',
    [UserStatus.BLOCKED]: 'доступ закрыт',
  },
  permissions: {
    [Permission.USERS]: 'Сотрудники',
    [Permission.TRAITS]: 'Признаки',
    [Permission.BROADCAST]: 'Рассылка',
    [Permission.SETTINGS]: 'Настройки',
  },
  bot: {
    noAccess: (channel, id) =>
      `Нет доступа. Ваш ${channel} ID: \`${id}\` — передайте его администратору.`,
    forbidden: 'Недостаточно прав для этого действия.',
    unknownCommand: 'Неизвестная команда. Список команд — /help.',
    unknownInput: 'Не понимаю сообщение. Список команд — /help.',
    expired: 'Эта кнопка больше не работает. Откройте раздел заново.',
    error: 'Что-то пошло не так. Попробуйте ещё раз чуть позже.',
  },
  start: {
    owner:
      'Здравствуйте! Вы владелец Report Daily, у вас есть все права. Управление ботом — /admin.',
    employee: (name) =>
      `Здравствуйте, ${name}! Каждый рабочий день я буду присылать вам отчёт о вашей работе в GitLab.`,
  },
  help: {
    title: '**Команды**',
    privacy: 'Текст вашего отчёта видите только вы.',
  },
  cancel: {
    done: 'Действие отменено.',
    nothing: 'Отменять нечего.',
  },
  admin: {
    title: '**Управление**',
    noSections: 'Для ваших прав здесь пока ничего нет.',
  },
  settings: {
    title: '**Мои настройки**',
    language: 'Язык',
    reportTime: 'Время отчёта',
    timeZone: 'Часовой пояс',
    defaultTimeZone: (zone) => `${zone}, по умолчанию`,
    useDefault: (zone) => `По умолчанию: ${zone}`,
    back: 'Назад',
    chooseLanguage: 'Выберите язык бота и отчётов.',
    chooseHour: (zone) => `Выберите час отчёта по часовому поясу ${zone}.`,
    chooseMinute: 'Выберите минуты.',
    timeZonePrompt: (zone) =>
      `Отправьте часовой пояс в формате IANA, например \`Europe/Moscow\` или \`Asia/Almaty\`. Сейчас: ${zone}.`,
    timeZoneInvalid: 'Не знаю такого часового пояса. Пример: `Europe/Moscow`.',
    gender: 'Пол',
    chooseGender:
      'Выберите пол: от него зависят формулировки отчёта, например «сделал» или «сделала».',
    ai: {
      name: 'AI',
      description: 'улучшать формулировки строк отчёта через AI',
    },
    aiData: {
      name: 'Данные в AI',
      description:
        'отправлять в AI заголовки моих коммитов и выдержки из моих комментариев',
    },
    on: 'да',
    off: 'нет',
  },
  traits: {
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
          description:
            'Не будет сделано: дубль, неактуально, не воспроизводится',
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
  },
  traitList: {
    title: (count) => `**Признаки** · лейблов GitLab: ${count}`,
    page: (page, pages) => `Страница ${page} из ${pages}`,
    empty:
      'Лейблов пока нет. Нажмите «Добавить»: бот спросит лейбл как в GitLab и какой признак задачи он означает.',
    previous: '‹ Назад',
    next: 'Дальше ›',
    add: 'Добавить',
    menu: 'Меню',
    backToList: 'К списку',
    notFound: 'Лейбл не найден: возможно, его уже удалили.',
    everyone: 'Для всех',
    addValue: 'Добавить признак',
    drop: 'Удалить лейбл',
  },
  traitManage: {
    askValue: (label, whom, dimension, value) =>
      `${label} ${whom} · ${dimension}\nСейчас: ${value}. Выберите другой признак или удалите этот.`,
    deleteValue: 'Удалить признак',
    back: '‹ Назад',
    changed: (label, whom, value) =>
      `Готово: ${label} ${whom} — теперь ${value}.`,
    valueDeleted: (label, whom, value) =>
      `Признак удалён: ${label} ${whom} — ${value}.`,
    labelEmpty: 'У лейбла больше нет признаков, он убран из списка.',
    confirmDrop: (label, count) =>
      `Удалить лейбл ${label}? Признаков у него: ${count}.`,
    confirm: 'Да, удалить',
    cancel: 'Отмена',
    dropped: (label) => `Лейбл ${label} удалён.`,
  },
  traitAdd: {
    prompt:
      'Пришлите лейбл как в GitLab, например `status::easy`. Регистр, лишние пробелы и `_` не важны.',
    invalid: (max) =>
      `Не похоже на лейбл. Пришлите его как в GitLab, например \`status::easy\`, не длиннее ${max} символов.`,
    exists: (label) => `Лейбл ${label} уже заведён.`,
    forWhom: (label) => `${label}\nДля кого задать признак?`,
    everyone: 'Для всех',
    forEveryone: 'для всех',
    forRole: (role) => `для роли «${role}»`,
    chooseDimension: (label, whom) =>
      `${label} ${whom}\nЧто этот лейбл значит? Выберите группу признаков.`,
    chooseValue: (label, whom, dimension) =>
      `${label} ${whom} · ${dimension}\nВыберите признак задачи.`,
    alreadySet: (label) =>
      `У лейбла ${label} уже есть признак в этой группе для выбранной роли. Изменить его можно в карточке.`,
    added: (label, whom, value) => `Готово: ${label} ${whom} — ${value}.`,
    openCard: 'Открыть карточку',
    addMore: 'Добавить ещё',
    back: '‹ Назад',
    cancel: 'Отмена',
    cancelled: 'Добавление отменено.',
  },
  employees: {
    title: (count) => `**Сотрудники** · ${count}`,
    page: (page, pages) => `Страница ${page} из ${pages}`,
    empty: 'Сотрудников пока нет.',
    previous: '‹ Назад',
    next: 'Дальше ›',
    search: 'Найти',
    add: 'Добавить',
    bind: (channel) => `Привязать ${channel}`,
    menu: 'Меню',
    backToList: 'К списку',
    searchPrompt: 'Введите имя или username в GitLab.',
    searchTitle: (query) => `**Поиск:** ${query}`,
    searchEmpty: 'Никого не нашлось.',
    searchTooMany: (limit) => `Показаны первые ${limit}, уточните запрос.`,
    notFound: 'Сотрудник не найден: возможно, его уже удалили.',
    card: {
      role: 'Роль',
      gender: 'Пол',
      status: 'Статус',
      channels: 'Каналы',
      permissions: 'Права',
      noChannels: 'не подключены',
      reachable: 'подключён',
      unreachable: 'недоступен, бот заблокирован',
    },
  },
  employeeAdd: {
    prompt: 'Введите имя или username сотрудника в GitLab.',
    gitlabUnavailable:
      'GitLab сейчас недоступен. Попробуйте чуть позже: просто отправьте запрос ещё раз.',
    gitlabCertificate:
      'GitLab не прошёл проверку сертификата: серверу бота нужен сертификат центра сертификации вашей компании. Владельцу: переменная `NODE_EXTRA_CA_CERTS`, подробности в README.',
    noMatches:
      'В GitLab никого не нашлось. Попробуйте другое имя или username.',
    pick: (query) => `**GitLab:** ${query}\nВыберите сотрудника.`,
    role: (name) => `**${name}**\nВыберите роль.`,
    gender: (name) => `**${name}**\nВыберите пол.`,
    alreadyAdded: (name) => `**${name}** уже есть среди сотрудников.`,
    added: (name) => `Сотрудник добавлен: **${name}**.`,
    activityHidden:
      'GitLab не показывает событий этого сотрудника: профиль закрыт или активности ещё не было. Если профиль закрыт, попросите сделать его публичным.',
    activityUnknown: 'Не удалось проверить активность сотрудника в GitLab.',
    pending: 'Канал ещё не привязан, поэтому отчёты пока не отправляются.',
    openCard: 'Открыть карточку',
    cancel: 'Отмена',
    cancelled: 'Добавление отменено.',
  },
  employeeManage: {
    changeRole: 'Сменить роль',
    block: 'Заблокировать',
    unblock: 'Разблокировать',
    delete: 'Удалить',
    confirm: 'Да, удалить',
    cancel: 'Отмена',
    chooseRole: (name, role) =>
      `**${name}**\nСейчас: ${role}. Выберите новую роль.`,
    roleChanged: (name, role) => `Роль изменена: **${name}** — ${role}.`,
    blocked: (name) =>
      `Сотрудник заблокирован: **${name}**. Бот больше не отвечает ему и не присылает отчёты.`,
    unblocked: (name) => `Сотрудник разблокирован: **${name}**.`,
    confirmDelete: (name) =>
      `Удалить сотрудника **${name}**? Его каналы и отчёты удалятся вместе с ним.`,
    deleted: (name) => `Сотрудник удалён: **${name}**.`,
    self: 'Нельзя заблокировать или удалить себя.',
    ownerOnly:
      'Сотрудника с правами может заблокировать или удалить только владелец.',
  },
  employeePermissions: {
    open: 'Права',
    title: (name) =>
      `**${name}**\nПрава в боте. Нажмите на право, чтобы выдать или снять его.`,
    descriptions: {
      [Permission.USERS]:
        'добавлять, менять, блокировать и удалять сотрудников',
      [Permission.TRAITS]: 'сопоставлять лейблы GitLab с признаками задачи',
      [Permission.BROADCAST]: 'делать рассылку всем сотрудникам',
      [Permission.SETTINGS]: 'пауза отчётов, AI, календарь, состояние системы',
    },
    granted: 'есть',
    revoked: 'нет',
  },
  employeeBind: {
    prompt: (channel, name) =>
      `**${name}**\nВыберите сотрудника в ${channel} или введите его ${channel} ID. ID бот показывает человеку, который пишет боту без доступа.`,
    pick: (channel) => `Выбрать в ${channel}`,
    pickPrompt:
      'Нажмите «Выбрать сотрудника» внизу экрана и выберите его из чатов или контактов. Отменить — /cancel.',
    pickButton: 'Выбрать сотрудника',
    invalid: (channel) =>
      `Это не похоже на ${channel} ID. Введите число, которое бот показал сотруднику.`,
    taken: (name) =>
      `Этот аккаунт уже привязан к сотруднику **${name}**. Введите другой ID.`,
    alreadyBound: (channel) => `У сотрудника уже привязан ${channel}.`,
    bound: (channel, name) => `${channel} привязан: **${name}**.`,
    hint: 'Если сотрудник ещё не писал боту, попросите его открыть бота и нажать Start.',
    cancel: 'Отмена',
    cancelled: 'Привязка отменена.',
  },
};
