import { z } from 'zod';
import { Channel } from 'src/common/channel/types/channel.enums';
import { BotNamespace } from '../../../core/types/bot.enums';
import { EmployeeBindAction } from '../types/employee-bind.enums';

export const EMPLOYEE_BIND_BUTTON_SCHEMA = z
  .tuple([
    z.literal(BotNamespace.EMPLOYEE_BIND),
    z.enum(EmployeeBindAction),
    z.uuid(),
    z.enum(Channel),
  ])
  .transform(([, action, userId, channel]) => ({ action, userId, channel }));

export const EMPLOYEE_BIND_DRAFT_SCHEMA = z.object({ userId: z.uuid(), channel: z.enum(Channel) });
