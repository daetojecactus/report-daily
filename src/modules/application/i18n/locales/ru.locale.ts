import { Channel } from 'src/common/enums/channel.enums';
import { BotCommand } from 'src/modules/application/bot/bot.enums';
import type { Locale } from '../i18n.interface';

export const ru: Locale = {
  channels: {
    [Channel.TELEGRAM]: 'Telegram',
    [Channel.SLACK]: 'Slack',
  },
  commands: {
    [BotCommand.START]: 'Начать работу с ботом',
    [BotCommand.HELP]: 'Список команд',
    [BotCommand.CANCEL]: 'Прервать текущее действие',
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
    owner: 'Здравствуйте! Вы владелец Report Daily, у вас есть все права.',
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
};
