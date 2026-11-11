import { z } from 'zod';
import { Permission } from 'src/modules/application/user/types/user.enums';
import { BotNamespace } from '../../types/bot.enums';
import { EmployeePermissionsAction } from '../types/employee-permissions.enums';

const NAMESPACE_SCHEMA = z.literal(BotNamespace.EMPLOYEE_PERMISSIONS);

export const EMPLOYEE_PERMISSIONS_BUTTON_SCHEMA = z.union([
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(EmployeePermissionsAction.OPEN), z.uuid()])
    .transform(([, action, userId]) => ({ action, userId })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.enum([EmployeePermissionsAction.GRANT, EmployeePermissionsAction.REVOKE]),
      z.uuid(),
      z.enum(Permission),
    ])
    .transform(([, action, userId, permission]) => ({
      action,
      userId,
      permission,
    })),
]);
