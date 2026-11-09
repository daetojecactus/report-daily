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
      description: 'отправлять в AI заголовки моих коммитов и выдержки из моих комментариев',
    },
    on: 'да',
    off: 'нет',
  },
};
