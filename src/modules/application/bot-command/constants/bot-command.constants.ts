import type { BotCommand } from 'src/modules/vendors/telegram/telegram.types';

//команды доступные только owner (для меню бота)
export const OWNER_BOT_COMMANDS: BotCommand[] = [
  { command: 'add_user', description: 'Добавить пользователя' },
  { command: 'update_user', description: 'Обновить пользователя' },
  { command: 'block_user', description: 'Заблокировать пользователя' },
  { command: 'unblock_user', description: 'Разблокировать пользователя' },
  { command: 'user_info', description: 'Информация о пользователе' },
  { command: 'list_users', description: 'Список пользователей' },
  { command: 'help', description: 'Список команд' },
];
