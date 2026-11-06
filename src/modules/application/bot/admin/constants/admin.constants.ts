import { z } from 'zod';
import { Permission } from 'src/modules/application/user/user.enums';
import { BOT_BUTTON_DATA_SEPARATOR } from '../../constants/bot.constants';
import { BotNamespace } from '../../bot.enums';
import { EmployeesAction } from '../../employees/employees.enums';
import { TraitsAction } from '../../traits/traits.enums';
import { AdminAction } from '../admin.enums';

export const ADMIN_MENU_DATA = [BotNamespace.ADMIN, AdminAction.MENU].join(
  BOT_BUTTON_DATA_SEPARATOR,
);

export const ADMIN_SECTIONS = [
  {
    permission: Permission.USERS,
    data: [BotNamespace.EMPLOYEES, EmployeesAction.LIST, 0].join(BOT_BUTTON_DATA_SEPARATOR),
  },
  {
    permission: Permission.TRAITS,
    data: [BotNamespace.TRAITS, TraitsAction.LIST, 0].join(BOT_BUTTON_DATA_SEPARATOR),
  },
];

export const ADMIN_BUTTON_SCHEMA = z.tuple([
  z.literal(BotNamespace.ADMIN),
  z.literal(AdminAction.MENU),
]);
