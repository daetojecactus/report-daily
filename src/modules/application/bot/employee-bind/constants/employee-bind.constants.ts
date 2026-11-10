import { z } from 'zod';
import { Channel } from 'src/common/enums/channel.enums';
import { BotNamespace } from '../../bot.enums';
import { EmployeeBindAction } from '../employee-bind.enums';

export const EMPLOYEE_BIND_BUTTON_SCHEMA = z
  .tuple([
    z.literal(BotNamespace.EMPLOYEE_BIND),
    z.enum(EmployeeBindAction),
    z.uuid(),
    z.enum(Channel),
  ])
  .transform(([, action, userId, channel]) => ({ action, userId, channel }));

export const EMPLOYEE_BIND_DRAFT_SCHEMA = z.object({ userId: z.uuid(), channel: z.enum(Channel) });
