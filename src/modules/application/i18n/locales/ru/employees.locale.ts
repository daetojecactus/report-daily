import { Channel } from 'src/common/channel/types/channel.enums';
import { ReportStatus } from 'src/modules/application/report/types/report.enums';
import type { EmployeesLocale } from '../../types/i18n-employees.interface';

export const ruEmployees: EmployeesLocale = {
  employees: {
    title: (count) => `**Сотрудники** · ${count}`,
    page: (page, pages) => `Страница ${page} из ${pages}`,
    empty: 'Сотрудников пока нет.',
    previous: 'Назад',
    next: 'Дальше',
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
      access: 'Доступ',
      admin: 'админ — публикует общие шаблоны',
      noChannels: 'не подключены',
      reachable: 'подключён',
      unreachable: 'недоступен, бот не может написать',
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
    makeAdmin: 'Сделать админом',
    removeAdmin: 'Снять админа',
    madeAdmin: (name) => `**${name}** теперь админ: создаёт и правит общие шаблоны.`,
    removedAdmin: (name) => `**${name}** больше не админ.`,
    reportNow: 'Отчёт сейчас',
    reportQueued: (name) =>
      `Собираю отчёт за сегодня для **${name}**. Он придёт сотруднику; если действий нет или сборка не удастся, напишу сюда.`,
    reportEmpty: (name) => `У **${name}** за сегодня нет действий в GitLab, отчёт не отправлен.`,
    reportFailed: (name) => `Не получилось собрать отчёт для **${name}**: GitLab не ответил.`,
    reportUnavailable: (name) =>
      `**${name}** не получит отчёт: сотрудник не активен или у него нет привязанного канала.`,
  },
  employeeBind: {
    prompt: (channel, name) =>
      `**${name}**\nВыберите сотрудника в ${channel} или введите его ${channel} ID.`,
    promptId: (channel, name) => `**${name}**\nВведите ${channel} ID сотрудника.`,
    idHint: {
      [Channel.TELEGRAM]:
        'Telegram ID — число. Проще выбрать сотрудника кнопкой «Выбрать в Telegram».',
      [Channel.SLACK]:
        'Slack ID есть в профиле участника: меню из трёх точек, пункт «Copy member ID».',
    },
    pick: (channel) => `Выбрать в ${channel}`,
    pickPrompt: {
      [Channel.TELEGRAM]:
        'Нажмите «Выбрать сотрудника» внизу экрана и выберите его из чатов или контактов. Отменить — /cancel.',
      [Channel.SLACK]: 'Выберите сотрудника в списке ниже. Отменить — /cancel.',
    },
    pickButton: 'Выбрать сотрудника',
    invalid: (channel) => `Это не похоже на ${channel} ID.`,
    taken: (name) => `Этот аккаунт уже привязан к сотруднику **${name}**. Введите другой ID.`,
    alreadyBound: (channel) => `У сотрудника уже привязан ${channel}.`,
    bound: (channel, name) => `${channel} привязан: **${name}**.`,
    hint: {
      [Channel.TELEGRAM]:
        'Если сотрудник ещё не писал боту, попросите его открыть бота и нажать Start.',
      [Channel.SLACK]:
        'Бот сам пишет сотруднику в личные сообщения Slack, ему ничего делать не нужно.',
    },
    unbind: (channel) => `Отвязать ${channel}`,
    confirmUnbind: (channel, name) =>
      `Отвязать ${channel} от **${name}**? Отчёты и рассылки туда больше не придут, а бот перестанет отвечать там сотруднику.`,
    confirmUnbindButton: 'Да, отвязать',
    unbound: (channel, name) => `${channel} отвязан от **${name}**.`,
    notBound: (channel) => `У сотрудника не привязан ${channel}.`,
    cancel: 'Отмена',
    cancelled: 'Привязка отменена.',
  },
};
