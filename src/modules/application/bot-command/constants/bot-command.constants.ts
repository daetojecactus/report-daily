import type { BotCommand } from 'src/modules/vendors/telegram/telegram.interface';
import type { Locale } from 'src/common/i18n/i18n.types';
import { UserRole, UserStatus } from '../../user/user.enums';

export function getOwnerBotCommands(locale: Locale): BotCommand[] {
  return [
    { command: 'add_user', description: locale.commands.descriptions.add_user },
    {
      command: 'update_user',
      description: locale.commands.descriptions.update_user,
    },
    {
      command: 'block_user',
      description: locale.commands.descriptions.block_user,
    },
    {
      command: 'unblock_user',
      description: locale.commands.descriptions.unblock_user,
    },
    {
      command: 'user_info',
      description: locale.commands.descriptions.user_info,
    },
    {
      command: 'list_users',
      description: locale.commands.descriptions.list_users,
    },
    {
      command: 'send_user_report',
      description: locale.commands.descriptions.send_user_report,
    },
    {
      command: 'broadcast',
      description: locale.commands.descriptions.broadcast,
    },
    { command: 'help', description: locale.commands.descriptions.help },
  ];
}

export function getUserBotCommands(locale: Locale): BotCommand[] {
  return [
    { command: 'info', description: locale.commands.descriptions.info },
    {
      command: 'send_report',
      description: locale.commands.descriptions.send_report,
    },
    {
      command: 'toggle_ai',
      description: locale.commands.descriptions.toggle_ai,
    },
    {
      command: 'change_report_hour',
      description: locale.commands.descriptions.change_report_hour,
    },
    { command: 'language', description: locale.commands.descriptions.language },
    { command: 'help', description: locale.commands.descriptions.help },
  ];
}

export const ALL_REPORT_HOURS = Array.from({ length: 24 }, (_, i) => i);
export const REPORT_HOURS = [
  6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
];
export const VALID_ROLES: string[] = Object.values(UserRole);
export const VALID_STATUSES: string[] = Object.values(UserStatus);

//маркер для передачи adminId при тестовом отчёте через callback
export const TEST_REPORT_MARKER = '__TEST_REPORT__:';
