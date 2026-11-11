import { z } from 'zod';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { BotNamespace } from '../../../core/types/bot.enums';
import { EmployeeManageAction } from '../types/employee-manage.enums';

const NAMESPACE_SCHEMA = z.literal(BotNamespace.EMPLOYEE_MANAGE);

export const EMPLOYEE_MANAGE_BUTTON_SCHEMA = z.union([
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.enum([
        EmployeeManageAction.ROLE,
        EmployeeManageAction.BLOCK,
        EmployeeManageAction.UNBLOCK,
        EmployeeManageAction.DELETE,
        EmployeeManageAction.CONFIRM_DELETE,
        EmployeeManageAction.REPORT,
        EmployeeManageAction.GRANT_ADMIN,
        EmployeeManageAction.REVOKE_ADMIN,
      ]),
      z.uuid(),
    ])
    .transform(([, action, userId]) => ({ action, userId })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(EmployeeManageAction.SET_ROLE), z.uuid(), z.enum(JobRole)])
    .transform(([, action, userId, role]) => ({ action, userId, role })),
]);
