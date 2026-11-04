import { z } from 'zod';
import { BotNamespace } from '../../bot.enums';
import { EmployeeBindAction } from '../employee-bind.enums';

export const EMPLOYEE_BIND_BUTTON_SCHEMA = z
  .tuple([
    z.literal(BotNamespace.EMPLOYEE_BIND),
    z.enum(EmployeeBindAction),
    z.uuid(),
  ])
  .transform(([, action, userId]) => ({ action, userId }));

export const EMPLOYEE_BIND_DRAFT_SCHEMA = z.object({ userId: z.uuid() });
