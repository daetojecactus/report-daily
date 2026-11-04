import { Channel } from 'src/common/enums/channel.enums';
import { BotCommand } from 'src/modules/application/bot/bot.enums';
import {
  Gender,
  JobRole,
  Permission,
  UserStatus,
} from 'src/modules/application/user/user.enums';
import type { Locale } from '../i18n.interface';

export const ru: Locale = {
  channels: {
    [Channel.TELEGRAM]: 'Telegram',
    [Channel.SLACK]: 'Slack',
  },
  commands: {
    [BotCommand.START]: 'Начать работу с ботом',
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
    [UserStatus.ON_LEAVE]: 'в отпуске',
    [UserStatus.BLOCKED]: 'доступ закрыт',
  },
  permissions: {
    [Permission.USERS]: 'Сотрудники',
    [Permission.LABELS]: 'Лейблы',
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
  employees: {
    title: (count) => `**Сотрудники** · ${count}`,
    page: (page, pages) => `Страница ${page} из ${pages}`,
    empty: 'Сотрудников пока нет.',
    previous: '‹ Назад',
    next: 'Дальше ›',
    search: 'Найти',
    add: 'Добавить',
    menu: 'Меню',
    backToList: 'К списку',
    searchPrompt: 'Введите имя или username в GitLab.',
    searchTitle: (query) => `**Поиск:** ${query}`,
    searchEmpty: 'Никого не нашлось.',
    searchTooMany: (limit) => `Показаны первые ${limit}, уточните запрос.`,
    notFound: 'Сотрудник не найден: возможно, его уже удалили.',
    card: {
      gitlab: 'GitLab',
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
};
