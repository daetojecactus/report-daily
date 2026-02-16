import type { BotCommand } from 'src/modules/vendors/telegram/telegram.types';
import { UserRole, UserStatus } from '../../user/user.interface';

//команды доступные только owner (для меню бота)
export const OWNER_BOT_COMMANDS: BotCommand[] = [
  { command: 'add_user', description: 'Добавить пользователя' },
  { command: 'update_user', description: 'Обновить пользователя' },
  { command: 'block_user', description: 'Заблокировать пользователя' },
  { command: 'unblock_user', description: 'Разблокировать пользователя' },
  { command: 'user_info', description: 'Информация о пользователе' },
  { command: 'list_users', description: 'Список пользователей' },
  { command: 'test_report', description: 'Тест отчёта' },
  { command: 'help', description: 'Список команд' },
];

//часы для выбора времени отчёта
export const REPORT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

//допустимые роли и статусы
export const VALID_ROLES: string[] = Object.values(UserRole);
export const VALID_STATUSES: string[] = Object.values(UserStatus);
