import { ReportStatus } from 'src/modules/application/report/report.enums';
import { Permission } from 'src/modules/application/user/user.enums';
import type { EmployeesLocale } from '../../i18n.interface';

export const ruEmployees: EmployeesLocale = {
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
      lastActivity: 'Последняя активность в GitLab',
      activityHidden: 'не видно — профиль закрыт или событий ещё нет',
      activityUnknown: 'не удалось проверить',
      lastReport: 'Последний отчёт',
      noReport: 'ещё не было',
      reportStatuses: {
        [ReportStatus.PENDING]: 'в очереди',
        [ReportStatus.GENERATING]: 'собирается',
        [ReportStatus.READY]: 'собран',
        [ReportStatus.DELIVERED]: 'доставлен',
        [ReportStatus.EMPTY]: 'действий не было',
        [ReportStatus.FAILED]: 'не удалось собрать',
      },
    },
  },
  employeeAdd: {
    prompt: 'Введите имя или username сотрудника в GitLab.',
    gitlabUnavailable:
      'GitLab сейчас недоступен. Попробуйте чуть позже: просто отправьте запрос ещё раз.',
    gitlabCertificate:
      'GitLab не прошёл проверку сертификата: серверу бота нужен сертификат центра сертификации вашей компании. Владельцу: переменная `NODE_EXTRA_CA_CERTS`, подробности в README.',
    noMatches: 'В GitLab никого не нашлось. Попробуйте другое имя или username.',
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
    chooseRole: (name, role) => `**${name}**\nСейчас: ${role}. Выберите новую роль.`,
    roleChanged: (name, role) => `Роль изменена: **${name}** — ${role}.`,
    blocked: (name) =>
      `Сотрудник заблокирован: **${name}**. Бот больше не отвечает ему и не присылает отчёты.`,
    unblocked: (name) => `Сотрудник разблокирован: **${name}**.`,
    confirmDelete: (name) =>
      `Удалить сотрудника **${name}**? Его каналы и отчёты удалятся вместе с ним.`,
    deleted: (name) => `Сотрудник удалён: **${name}**.`,
    self: 'Нельзя заблокировать или удалить себя.',
    ownerOnly: 'Сотрудника с правами может заблокировать или удалить только владелец.',
    reportNow: 'Отчёт сейчас',
    reportQueued: (name) =>
      `Собираю отчёт за сегодня для **${name}**. Он придёт сотруднику; если действий нет или сборка не удастся, напишу сюда.`,
    reportEmpty: (name) => `У **${name}** за сегодня нет действий в GitLab, отчёт не отправлен.`,
    reportFailed: (name) => `Не получилось собрать отчёт для **${name}**: GitLab не ответил.`,
    reportUnavailable: (name) =>
      `**${name}** не получит отчёт: сотрудник не активен или у него нет подключённого Telegram.`,
  },
  employeePermissions: {
    open: 'Права',
    title: (name) => `**${name}**\nПрава в боте. Нажмите на право, чтобы выдать или снять его.`,
    descriptions: {
      [Permission.USERS]: 'добавлять, менять, блокировать и удалять сотрудников',
      [Permission.TRAITS]: 'сопоставлять лейблы GitLab с признаками задачи',
      [Permission.SETTINGS]: 'пауза отчётов, AI, состояние системы',
      [Permission.TEMPLATES]: 'создавать, править и удалять общие шаблоны отчёта',
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
    taken: (name) => `Этот аккаунт уже привязан к сотруднику **${name}**. Введите другой ID.`,
    alreadyBound: (channel) => `У сотрудника уже привязан ${channel}.`,
    bound: (channel, name) => `${channel} привязан: **${name}**.`,
    hint: 'Если сотрудник ещё не писал боту, попросите его открыть бота и нажать Start.',
    cancel: 'Отмена',
    cancelled: 'Привязка отменена.',
  },
};
