import { Channel } from 'src/common/enums/channel.enums';
import { BotCommand } from 'src/modules/application/bot/bot.enums';
import { Source } from 'src/modules/application/source/source.enums';
import { Gender, JobRole, Permission, UserStatus } from 'src/modules/application/user/user.enums';
import type { CommonLocale } from '../../i18n.interface';
import { Language } from '../../i18n.enums';

export const ruCommon: CommonLocale = {
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
    [BotCommand.REPORT]: 'Отчёт за сегодня',
    [BotCommand.SETTINGS]: 'Мои настройки',
    [BotCommand.ADMIN]: 'Управление ботом',
    [BotCommand.HELP]: 'Список команд',
    [BotCommand.CANCEL]: 'Прервать текущее действие',
  },
  report: {
    choose: 'За какой день собрать отчёт?',
    today: 'Сегодня',
    yesterday: 'Вчера',
    otherDay: 'Другой день',
    chooseDay: (days) => `Выберите день — не раньше чем ${days} дней назад.`,
    back: '‹ Назад',
    todayText: 'сегодня',
    yesterdayText: 'вчера',
    building: (day) => `Собираю отчёт за ${day}. Пришлю, как только будет готов.`,
    rebuilding: (day) => `Пересобираю отчёт за ${day}. Пришлю новый, как только будет готов.`,
    empty: (day) => `За ${day} в GitLab нет ваших действий, отчёта нет.`,
    failed: 'Не получилось собрать отчёт: GitLab не ответил. Попробуйте ещё раз позже.',
    rebuild: 'Пересобрать',
    wait: (seconds) => `Пересобрать можно раз в минуту. Попробуйте через ${seconds} с.`,
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
    [Permission.TEMPLATES]: 'Шаблоны',
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
    schedule: {
      name: 'Отчёт по расписанию',
      description:
        'присылать отчёт самому в ваше время в дни с действиями; `/report` работает всегда',
    },
    ai: {
      name: 'AI',
      description: 'улучшать формулировки строк отчёта через AI',
    },
    aiData: {
      name: 'Данные в AI',
      description: 'отправлять в AI заголовки моих коммитов и выдержки из моих комментариев',
    },
    on: 'да',
    off: 'нет',
    template: 'Шаблон отчёта',
  },
  templates: {
    title: '**Шаблон отчёта**',
    current: (name) => `Сейчас: ${name}. Выберите шаблон: «Стандартный», общий или свой.`,
    standard: 'Стандартный',
    shared: (name) => `${name} (общий)`,
    mine: 'Мои шаблоны',
    toSettings: '‹ Настройки',
    chosen: (name) => `Готово: отчёт будет приходить в шаблоне «${name}».`,
    notFound: 'Шаблон не найден: возможно, его уже удалили.',
    mineTitle: (count) => `**Мои шаблоны** · ${count}`,
    mineEmpty: 'Своих шаблонов пока нет. Нажмите «Создать»: бот спросит название и текст шаблона.',
    create: 'Создать',
    back: '‹ Назад',
    use: 'Выбрать',
    delete: 'Удалить',
    backToMine: '‹ Мои шаблоны',
    confirmDelete: (name) =>
      `Удалить шаблон **${name}**? Если он выбран, отчёт вернётся к «Стандартному».`,
    confirm: 'Да, удалить',
    cancel: 'Отмена',
    deleted: (name) => `Шаблон **${name}** удалён.`,
    askName: (max) => `Как назвать шаблон? Название видно в списке, до ${max} символов.`,
    nameInvalid: (max) => `Название должно быть от 1 до ${max} символов.`,
    askBody: (name, max) =>
      `**${name}**\nПришлите текст шаблона на Liquid, до ${max} символов. Данные отчёта — в \`context\`: проекты \`context.projects\` (у проекта \`name\` и строки \`items\`), у строки — \`text\`, \`title\`, \`action\`, \`url\`. Пример:\n\`{% for project in context.projects %}{{ project.name }}:\n{% for item in project.items %}• {{ item.text }}\n{% endfor %}{% endfor %}\`\nВсе поля контекста — в README, раздел «Your own templates».`,
    bodyInvalid: (max) => `Текст шаблона должен быть от 1 до ${max} символов.`,
    syntaxError: (error) => `В шаблоне ошибка: ${error}. Исправьте и пришлите текст ещё раз.`,
    renderError: (error) =>
      `Шаблон не отрисовался на ваших данных: ${error}. Исправьте и пришлите текст ещё раз.`,
    preview: (date) => `Предпросмотр на вашем отчёте за ${date}:`,
    emptyOutput: '(шаблон ничего не вывел)',
    noPreview:
      'Ошибок в шаблоне нет. Предпросмотра нет: у вас ещё нет собранного отчёта — его даст `/report`.',
    previewHint:
      'Чтобы поправить, пришлите исправленный текст или нажмите «Изменить текст». Шаблон сохранится только по «Сохранить».',
    save: 'Сохранить',
    saved: (name) => `Шаблон **${name}** сохранён.`,
    cancelled: 'Создание шаблона отменено.',
    editText: 'Изменить текст',
    rename: 'Переименовать',
    askNewName: (name, max) => `Новое название для **${name}**? До ${max} символов.`,
    renamed: (name) => `Готово: шаблон теперь называется **${name}**.`,
    bodyReplaced: (name) =>
      `Текст шаблона **${name}** обновлён. Следующий отчёт придёт по новому тексту.`,
    editCancelled: 'Изменение отменено.',
    backToTemplate: '‹ К шаблону',
  },
  sharedTemplates: {
    title: (count) => `**Общие шаблоны** · ${count}`,
    hint: 'Общий шаблон любой сотрудник может выбрать себе в /settings → «Шаблон отчёта».',
    empty:
      'Общих шаблонов пока нет. Нажмите «Создать»: бот спросит название и текст шаблона, а сотрудники выберут его в /settings.',
    create: 'Создать',
    menu: 'Меню',
    usedBy: (count) => `Выбрали сотрудников: ${count}`,
    backToList: '‹ Общие шаблоны',
    confirmDelete: (name, count) =>
      `Удалить общий шаблон **${name}**? Выбрали сотрудников: ${count}, у них отчёт вернётся к «Стандартному».`,
    saved: (name) =>
      `Общий шаблон **${name}** сохранён. Сотрудники выберут его в /settings → «Шаблон отчёта».`,
  },
  adminSettings: {
    title: '**Настройки**',
    reportsOn: 'Отчёты по расписанию: идут.',
    pausedToday: 'Отчёты по расписанию: пауза на сегодня.',
    pausedUntil: (date) => `Отчёты по расписанию: пауза по ${date} включительно.`,
    pausedForever: 'Отчёты по расписанию: пауза без срока.',
    hint: 'На паузе бот не присылает отчёты по расписанию никому. `/report` и «Отчёт сейчас» работают.',
    pauseToday: 'Пауза на сегодня',
    pauseUntil: 'Пауза до даты',
    pauseForever: 'Пауза без срока',
    resume: 'Снять паузу',
    chooseDay: (days) =>
      `По какой день включительно поставить паузу? Можно выбрать не дальше чем на ${days} дней вперёд, дольше — «Пауза без срока».`,
    back: '‹ Назад',
    menu: '‹ Меню',
    aiAlways:
      'В AI всегда уходят фраза действия, название и тип задачи. Чужие комментарии, описания задач, email и токены — никогда.',
    aiNotConfigured: 'AI не настроен: нужны переменные `LLM_BASE_URL`, `LLM_TOKEN` и `LLM_MODEL`.',
    ai: {
      name: 'AI для всех',
      description:
        'улучшать формулировки строк отчёта; сотрудник может выключить у себя в /settings',
    },
    aiCommits: {
      name: 'Коммиты в AI',
      description: 'отправлять заголовки коммитов сотрудника за день',
    },
    aiComments: {
      name: 'Комментарии в AI',
      description: 'отправлять выдержки до 150 символов из комментариев сотрудника за день',
    },
    on: 'да',
    off: 'нет',
  },
};
