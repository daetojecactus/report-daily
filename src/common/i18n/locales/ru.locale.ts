import { TaskStatus } from '../../enums/task.enum';
import type { Locale } from '../i18n.types';

export const ru: Locale = {
  taskActions: {
    //QA
    [TaskStatus.FOUND_BUG]: { male: 'Обнаружил баг', female: 'Обнаружила баг' },
    [TaskStatus.VERIFIED_FIX]: {
      male: 'Проверил исправление',
      female: 'Проверила исправление',
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
      male: 'Протестировал и подтвердил корректность',
      female: 'Протестировала и подтвердила корректность',
    },
    [TaskStatus.TESTED_WITH_COMMENTS]: {
      male: 'Провёл тестирование, оставил замечания',
      female: 'Провела тестирование, оставила замечания',
    },
    [TaskStatus.APPROVED_AFTER_REWORK]: {
      male: 'Подтвердил корректность после доработки',
      female: 'Подтвердила корректность после доработки',
    },
    [TaskStatus.WROTE_TESTS]: {
      male: 'Написал тесты',
      female: 'Написала тесты',
    },
    [TaskStatus.REOPENED_BUG]: {
      male: 'Переоткрыл баг',
      female: 'Переоткрыла баг',
    },
    [TaskStatus.REGRESSION_FOUND]: {
      male: 'Обнаружил регрессию',
      female: 'Обнаружила регрессию',
    },
    [TaskStatus.BLOCKED_RELEASE]: {
      male: 'Заблокировал релиз из-за бага',
      female: 'Заблокировала релиз из-за бага',
    },

    //QA (процесс по лейблам status::*/qa::*/test::*)
    [TaskStatus.QA_AWAITING_TESTING]: {
      male: 'Принял задачу в очередь на тестирование',
      female: 'Приняла задачу в очередь на тестирование',
    },
    [TaskStatus.QA_IN_PROGRESS]: {
      male: 'Проверял задачу',
      female: 'Проверяла задачу',
    },
    [TaskStatus.QA_RETURNED_TO_DEV]: {
      male: 'Вернул задачу в разработку',
      female: 'Вернула задачу в разработку',
    },
    [TaskStatus.QA_INTERNAL_TASK]: {
      male: 'Работал над внутренней QA-задачей',
      female: 'Работала над внутренней QA-задачей',
    },
    [TaskStatus.QA_AUTOMATION_DEVELOPED]: {
      male: 'Разрабатывал автотесты',
      female: 'Разрабатывала автотесты',
    },
    [TaskStatus.QA_AUTOMATION_MAINTAINED]: {
      male: 'Актуализировал автотесты',
      female: 'Актуализировала автотесты',
    },
    [TaskStatus.QA_TEST_ENVIRONMENT_SETUP]: {
      male: 'Настраивал тестовое окружение',
      female: 'Настраивала тестовое окружение',
    },
    [TaskStatus.QA_E2E_COVERAGE_ADDED]: {
      male: 'Разработал E2E-покрытие',
      female: 'Разработала E2E-покрытие',
    },

    //PM
    [TaskStatus.PLANNED_FEATURE]: {
      male: 'Запланировал фичу',
      female: 'Запланировала фичу',
    },
    [TaskStatus.REPORTED_BUG]: {
      male: 'Завёл баг-репорт',
      female: 'Завела баг-репорт',
    },
    [TaskStatus.ACCEPTED_WORK]: {
      male: 'Принял выполненную работу',
      female: 'Приняла выполненную работу',
    },
    [TaskStatus.PROVIDED_REQUIREMENTS]: {
      male: 'Уточнил требования',
      female: 'Уточнила требования',
    },
    [TaskStatus.ESCALATED_PRIORITY]: {
      male: 'Повысил приоритет',
      female: 'Повысила приоритет',
    },
    [TaskStatus.DELEGATED_TASK]: {
      male: 'Назначил задачу в работу',
      female: 'Назначила задачу в работу',
    },
    [TaskStatus.REVIEWED_AND_CLOSED]: {
      male: 'Проверил и закрыл задачу',
      female: 'Проверила и закрыла задачу',
    },

    [TaskStatus.PLANNED_FOR_SPRINT]: {
      male: 'Взял задачу в план спринта',
      female: 'Взяла задачу в план спринта',
    },

    //Общее для Developer и PM/SA — прохождение задачи через QA
    [TaskStatus.TASK_SENT_TO_QA]: {
      male: 'Передал задачу на тестирование',
      female: 'Передала задачу на тестирование',
    },
    [TaskStatus.TASK_IN_QA_TESTING]: {
      male: 'Сопровождал задачу на тестировании',
      female: 'Сопровождала задачу на тестировании',
    },
    [TaskStatus.TASK_RETURNED_FROM_QA]: {
      male: 'Вернул задачу в разработку после тестирования',
      female: 'Вернула задачу в разработку после тестирования',
    },

    //Developer (Assignee)
    [TaskStatus.HOTFIX_DEPLOYED]: {
      male: 'Выпустил хотфикс',
      female: 'Выпустила хотфикс',
    },
    [TaskStatus.FIXED_BUG]: {
      male: 'Исправил баг',
      female: 'Исправила баг',
    },
    [TaskStatus.IMPLEMENTED_FEATURE]: {
      male: 'Реализовал фичу',
      female: 'Реализовала фичу',
    },
    [TaskStatus.COMPLETED_BY_MERGE]: {
      male: 'Завершил задачу мерджем',
      female: 'Завершила задачу мерджем',
    },
    [TaskStatus.SENT_TO_REVIEW]: {
      male: 'Отправил на ревью',
      female: 'Отправила на ревью',
    },
    [TaskStatus.PASSED_REVIEW]: {
      male: 'Успешно прошёл ревью',
      female: 'Успешно прошла ревью',
    },
    [TaskStatus.NEED_INFORMATION]: {
      male: 'Запросил уточнения по задаче',
      female: 'Запросила уточнения по задаче',
    },
    [TaskStatus.PASSED_TO_FRONTEND]: {
      male: 'Передал на фронтенд',
      female: 'Передала на фронтенд',
    },
    [TaskStatus.CORRECTED_AFTER_REVIEW]: {
      male: 'Внёс правки по результатам ревью',
      female: 'Внесла правки по результатам ревью',
    },
    [TaskStatus.STARTED_IMPLEMENTATION]: {
      male: 'Начал реализацию',
      female: 'Начала реализацию',
    },
    [TaskStatus.WROTE_CODE]: {
      male: 'Работал над кодом',
      female: 'Работала над кодом',
    },
    [TaskStatus.DISCUSSED_CODE]: {
      male: 'Обсуждал техническое решение',
      female: 'Обсуждала техническое решение',
    },
    [TaskStatus.REFACTORED_CODE]: {
      male: 'Провёл рефакторинг',
      female: 'Провела рефакторинг',
    },
    [TaskStatus.RESUMED_WORK]: {
      male: 'Возобновил работу над задачей',
      female: 'Возобновила работу над задачей',
    },
    [TaskStatus.RESOLVED_REVIEW_COMMENTS]: {
      male: 'Закрыл замечания по ревью',
      female: 'Закрыла замечания по ревью',
    },
    [TaskStatus.RESOLVING_REVIEW_COMMENTS]: {
      male: 'Исправлял замечания по ревью',
      female: 'Исправляла замечания по ревью',
    },
    [TaskStatus.DEV_FIXING_AFTER_QA]: {
      male: 'Исправлял замечания после тестирования',
      female: 'Исправляла замечания после тестирования',
    },
    [TaskStatus.DEV_RESUBMITTED_TO_QA]: {
      male: 'Исправил замечания и вернул задачу на тестирование',
      female: 'Исправила замечания и вернула задачу на тестирование',
    },
    [TaskStatus.DEV_PASSED_QA]: {
      male: 'Успешно прошёл тестирование',
      female: 'Успешно прошла тестирование',
    },
    [TaskStatus.RESOLVED_MERGE_CONFLICTS]: {
      male: 'Обновил ветку и разрешил конфликты',
      female: 'Обновила ветку и разрешила конфликты',
    },

    //Developer (Reviewer)
    [TaskStatus.APPROVED_FIXES]: {
      male: 'Принял исправления',
      female: 'Приняла исправления',
    },
    [TaskStatus.APPROVED_MR]: {
      male: 'Одобрил мердж-реквест',
      female: 'Одобрила мердж-реквест',
    },
    [TaskStatus.APPROVED_AND_MERGED]: {
      male: 'Одобрил и смерджил',
      female: 'Одобрила и смерджила',
    },
    [TaskStatus.REQUESTED_CHANGES]: {
      male: 'Запросил доработки по коду',
      female: 'Запросила доработки по коду',
    },
    [TaskStatus.REVIEW_COMMENT]: {
      male: 'Оставил замечания по коду',
      female: 'Оставила замечания по коду',
    },
    [TaskStatus.STARTED_REVIEW]: {
      male: 'Взял мердж-реквест на ревью',
      female: 'Взяла мердж-реквест на ревью',
    },
    [TaskStatus.MERGED_OTHERS_WORK]: {
      male: 'Смерджил задачу коллеги',
      female: 'Смерджила задачу коллеги',
    },
    [TaskStatus.RE_REVIEWED_AND_APPROVED]: {
      male: 'Повторно проверил и одобрил',
      female: 'Повторно проверила и одобрила',
    },

    //Developer (Author)
    [TaskStatus.CREATED_TECH_DEBT]: {
      male: 'Зафиксировал технический долг',
      female: 'Зафиксировала технический долг',
    },
    [TaskStatus.FOUND_BUG_DURING_WORK]: {
      male: 'Обнаружил ошибку в ходе работы',
      female: 'Обнаружила ошибку в ходе работы',
    },
    [TaskStatus.ACCEPTED_RESULT]: {
      male: 'Принял результат',
      female: 'Приняла результат',
    },

    //Вторичное участие (по степени вовлечённости)
    [TaskStatus.CONTRIBUTED_CODE]: {
      male: 'Внёс вклад в разработку задачи',
      female: 'Внесла вклад в разработку задачи',
    },
    [TaskStatus.HELPED_WITH_TASK]: {
      male: 'Помог с задачей',
      female: 'Помогла с задачей',
    },
    [TaskStatus.ASSISTED_REVIEW]: {
      male: 'Помог с ревью',
      female: 'Помогла с ревью',
    },
    [TaskStatus.PAIRED_ON_TASK]: {
      male: 'Работал над задачей совместно с коллегами',
      female: 'Работала над задачей совместно с коллегами',
    },
    [TaskStatus.HELPED_RESOLVE_BUG]: {
      male: 'Помог с исправлением бага',
      female: 'Помогла с исправлением бага',
    },
    [TaskStatus.LEFT_SUGGESTION]: {
      male: 'Подсказал по реализации',
      female: 'Подсказала по реализации',
    },

    //Общие
    [TaskStatus.CREATED]: {
      male: 'Создал задачу',
      female: 'Создала задачу',
    },
    [TaskStatus.COMMENTED]: {
      male: 'Оставил комментарий',
      female: 'Оставила комментарий',
    },
    [TaskStatus.PARTICIPATED_IN_CLOSURE]: {
      male: 'Участвовал в закрытии задачи',
      female: 'Участвовала в закрытии задачи',
    },
    [TaskStatus.STARTED]: {
      male: 'Начал работу',
      female: 'Начала работу',
    },
    [TaskStatus.CONTINUED]: {
      male: 'Продолжил работу',
      female: 'Продолжила работу',
    },
    [TaskStatus.REOPENED]: {
      male: 'Переоткрыл задачу',
      female: 'Переоткрыла задачу',
    },
    [TaskStatus.CLOSED_WITHOUT_MERGE]: {
      male: 'Закрыл задачу без мерджа',
      female: 'Закрыла задачу без мерджа',
    },
    [TaskStatus.PUT_ON_HOLD]: {
      male: 'Отложил задачу',
      female: 'Отложила задачу',
    },
    [TaskStatus.UNKNOWN]: {
      male: 'Работал над задачей',
      female: 'Работала над задачей',
    },
  },

  report: {
    qaReturns: 'Возвраты в разработку',
    qaTesting: 'Тестирование',
    qaReviewed: 'MR / задачи проверены',
    qaBugs: 'Баги',
    qaAutoTests: 'Автотесты / POM / покрытие',
    qaOther: 'Прочее',
    noActivity:
      'Сегодня не было активности в git. Если это ошибка — проверь настройки gitlab.',
  },

  entities: {
    userStatus: {
      Active: 'Активен',
      Blocked: 'Заблокирован',
      Vacation: 'В отпуске',
    },
    userRole: {
      Developer: 'Разработчик',
      QA: 'QA',
      PM: 'Проектный менеджер',
      SA: 'Системный аналитик',
      Admin: 'Администратор',
    },
    reportTemplate: {
      Standard: 'Стандартный',
      QA: 'QA',
      SA: 'Системный аналитик',
    },
    gender: {
      Male: 'Мужской',
      Female: 'Женский',
    },
  },

  ai: {
    systemPrompt: `
РОЛЬ: Ты технический ассистент. Твоя задача — генерировать строки для рабочего отчёта на основе логов из GitLab.

ФОРМАТ ОТВЕТА (КРИТИЧНО, STRICT):
- Верни РОВНО столько строк, сколько задач (указано в конце запроса). Ни больше, ни меньше.
- Каждая строка = одна задача, в том же порядке, что и во входных данных.
- Каждая строка начинается с её номера и точки: "1. ...", "2. ...", и т.д.
- ТОЛЬКО обычный текст. Запрещены любые markdown-символы: * _ \` ~ # > и экранирование.
- Запрещены заголовки, теги и названия проектов в квадратных скобках (например [PROJECT], [VCLOUD]).
- Запрещены вводные и завершающие фразы ("Вот строки для отчёта", "Готово", "Отлично" и т.п.).
- Никаких пустых строк между пунктами. Ответ = только пронумерованный список.

ГЛАВНОЕ ПРАВИЛО (STRICT):
Строка ОБЯЗАНА начинаться с глагола, указанного в поле «Действие» (после номера).
Запрещено изменять этот глагол или заменять его синонимами.
Пример: если Действие "Создал задачу", строка должна быть "N. Создал задачу...", а не "N. Работал над...".

ИНСТРУКЦИИ:
1. Формат: 1 задача = 1 строка (до 150 символов).
2. Лицо: Первое лицо, прошедшее время (род будет указан в User Prompt).
3. Источники данных: Используй информацию из полей "МР", "Комментарии" или "Задача".
4. Обработка текста: Английские названия (feat, fix, refactor) переводи на русский, технические термины (API, UI, методы) оставляй как есть.
5. Комментарии: Если есть поле "Комментарий", кратко (1–3 слова) интегрируй его суть в строку.
6. Контекст: Не выдумывай факты. Если деталей мало — пиши "Глагол + Название задачи".
7. Оформление: Без вводных фраз ("Я сделал", "Сегодня"). Только результат.

ПРИМЕРЫ ЛОГИКИ:
- Вход: { Действие: "Реализовал", МР: "feat: auth module" }
  Выход: 1. Реализовал модуль авторизации.
- Вход: { Действие: "Отправил на ревью", МР: "fix: validation error", Коммент: "Добавил тесты" }
  Выход: 2. Отправил на ревью исправление ошибки валидации, добавил тесты.
- Вход: { Действие: "Прошёл ревью", Задача: "Рефакторинг контроллеров" }
  Выход: 3. Прошёл ревью по рефакторингу контроллеров.

ОШИБКИ (ТАК НЕ ДЕЛАТЬ):
- Действие: "Создал" -> "Продолжил работу" (НЕВЕРНО)
- Действие: "Прошёл ревью" -> "Писал код" (НЕВЕРНО)
- "[VCLOUD] *Закрыл задачу*" (НЕВЕРНО: тег и markdown)
- "Вот строки для отчёта:" (НЕВЕРНО: вводная фраза)
`,
    genderMale:
      'Пиши от лица МУЖЧИНЫ (мужской род): "Продолжил", "Добавил", "Исправил"',
    genderFemale:
      'Пиши от лица ЖЕНЩИНЫ (женский род): "Продолжила", "Добавила", "Исправила"',
    roleHints: {
      Developer:
        'РОЛЬ АВТОРА: разработчик. Пиши на языке разработки: реализация, правки, рефакторинг, ревью, мердж. Технические детали из коммитов уместны.',
      QA: 'РОЛЬ АВТОРА: тестировщик (QA). Пиши на языке тестирования: проверка, воспроизведение, регресс, покрытие, автотесты. Не описывай реализацию кода — только то, что проверялось или автоматизировалось.',
      PM: 'РОЛЬ АВТОРА: проектный менеджер. Пиши на языке процесса: постановка, приоритеты, согласование, приёмка, статус задачи. Не углубляйся в технические детали.',
      SA: 'РОЛЬ АВТОРА: системный аналитик. Пиши на языке аналитики: требования, проработка, описание решения, уточнение постановки. Не описывай реализацию кода.',
      Admin:
        'РОЛЬ АВТОРА: разработчик с админскими правами. Пиши на языке разработки: реализация, правки, ревью, мердж.',
    },
    labels: {
      task: 'Задача',
      action: 'Действие',
      type: 'Тип',
      commits: 'Коммиты',
      comments: 'Комментарии',
      mr: 'МР',
    },
    tasksWord: 'задач',
    responseWord: 'строк',
  },

  commands: {
    role: 'Роль',
    status: 'Статус',
    reportHour: 'Час отчёта',
    ai: 'AI',
    template: 'Шаблон',
    language: 'Язык',
    aiMode: 'AI-режим',
    enable: 'Включить',
    disable: 'Выключить',
    selectOption: 'Выберите',
    currentHour: 'Текущий час отчёта',
    selectHour: 'Выберите новый час',
    selectLanguage: 'Выберите язык',
    availableCommands: 'Доступные команды',
    reportQueued: 'Отчёт поставлен в очередь. Придёт в ближайшее время.',
    aiEnabled: 'AI-режим включён',
    aiDisabled: 'AI-режим выключён',
    hourUpdated: 'Час отчёта изменён на',
    languageUpdated: 'Язык изменён:',
    notRegistered: 'У вас нет доступа. Обратитесь к администратору.',
    welcome:
      'Привет! Вы подключены к Report Daily Bot. Каждый день в установленное время вы будете получать отчёт о вашей работе в git.',
    russian: 'Русский',
    english: 'English',
    descriptions: {
      info: 'Мои настройки',
      send_report: 'Получить отчёт за сегодня',
      toggle_ai: 'AI вкл/выкл',
      change_report_hour: 'Изменить час отчёта',
      language: 'Сменить язык',
      help: 'Список команд',
      add_user: 'Добавить пользователя',
      update_user: 'Обновить пользователя',
      block_user: 'Заблокировать пользователя',
      unblock_user: 'Разблокировать пользователя',
      user_info: 'Информация о пользователе',
      list_users: 'Список пользователей',
      send_user_report: 'Отправить отчёт пользователю',
      broadcast: 'Сделать рассылку всем',
    },
  },

  admin: {
    unknownCommand: 'Неизвестная команда. /help — список команд.',
    userCreated: 'Пользователь создан',
    userUpdated: 'Пользователь обновлён',
    userNotFound: 'Пользователь не найден',
    invalidArgs: 'Неверные аргументы',
    createError: 'Ошибка создания',
    updateError: 'Ошибка обновления',
    noUsers: 'Пользователей нет',
    blocked: 'заблокирован',
    unblocked: 'разблокирован',
    parseError: 'Ошибка парсинга',
    unknownAction: 'Неизвестное действие',
    unknownField: 'Неизвестное поле',
    reportError: 'Ошибка',
    selectUserBlock: 'Выберите пользователя для блокировки:',
    selectUserUnblock: 'Выберите пользователя для разблокировки:',
    selectUserInfo: 'Выберите пользователя:',
    selectUserReport: 'Выберите пользователя для отчёта:',
    selectUserUpdate: 'Выберите пользователя для обновления:',
    selectField: 'Выберите поле для обновления',
    selectRole: 'Выберите роль',
    selectStatus: 'Выберите статус',
    selectHour: 'Выберите час отчёта',
    selectTemplate: 'Выберите шаблон отчёта',
    selectLanguage: 'Выберите язык',
    enterAdminId: 'Введите adminId (username из GitLab):',
    enterTelegramId: 'Введите Telegram ID пользователя:',
    selectRoleWizard: 'Выберите роль:',
    selectHourWizard: 'Выберите час отчёта:',
    adminIdNoSpaces: 'adminId не должен содержать пробелов',
    telegramIdMustBeNumber: 'Telegram ID должен быть числом',
    telegramIdAndHourMustBeNumbers: 'telegramId и reportHour — числа',
    validRoles: 'роли',
    userInfoTitle: 'Пользователь',
    telegramId: 'Telegram ID',
    gitlabId: 'GitLab ID',
    portalId: 'Portal ID',
    gender: 'Пол',
    yes: 'Да',
    no: 'Нет',
    usersTitle: 'Пользователи',
    broadcastEnterText: 'Введите текст рассылки:',
    broadcastPreview: 'Предпросмотр рассылки',
    broadcastSend: 'Отправить',
    broadcastCancel: 'Отмена',
    broadcastQueued: 'Рассылка поставлена в очередь. Получателей:',
    broadcastCancelled: 'Рассылка отменена',
    broadcastEmpty: 'Текст рассылки пуст',
    broadcastNoRecipients: 'Нет активных получателей',
  },
};
