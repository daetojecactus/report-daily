import { z } from 'zod';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { BotNamespace } from '../../../core/types/bot.enums';
import { EmployeeManageAction } from '../types/employee-manage.enums';

const NAMESPACE_SCHEMA = z.literal(BotNamespace.EMPLOYEE_MANAGE);

export const EMPLOYEE_MANAGE_CONFIRM = 'ok';

const CONFIRMED_ACTION_SCHEMA = z.enum([
  EmployeeManageAction.BLOCK,
  EmployeeManageAction.UNBLOCK,
  EmployeeManageAction.REPORT,
  EmployeeManageAction.GRANT_ADMIN,
  EmployeeManageAction.REVOKE_ADMIN,
]);

export const EMPLOYEE_MANAGE_BUTTON_SCHEMA = z.union([
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.enum([
        EmployeeManageAction.ROLE,
        EmployeeManageAction.DELETE,
        EmployeeManageAction.CONFIRM_DELETE,
      ]),
      z.uuid(),
    ])
    .transform(([, action, userId]) => ({ action, userId, isConfirmed: true as const })),
  z
    .tuple([NAMESPACE_SCHEMA, CONFIRMED_ACTION_SCHEMA, z.uuid()])
    .transform(([, action, userId]) => ({ action, userId, isConfirmed: false as const })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      CONFIRMED_ACTION_SCHEMA,
      z.uuid(),
      z.literal(EMPLOYEE_MANAGE_CONFIRM),
    ])
    .transform(([, action, userId]) => ({ action, userId, isConfirmed: true as const })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(EmployeeManageAction.SET_ROLE), z.uuid(), z.enum(JobRole)])
    .transform(([, action, userId, role]) => ({
      action,
      userId,
      role,
      isConfirmed: true as const,
    })),
]);
