import { z } from 'zod';
import { Gender, JobRole } from 'src/modules/application/user/types/user.enums';
import { BotNamespace } from '../../types/bot.enums';
import { EmployeeAddAction } from '../types/employee-add.enums';

const NAMESPACE_SCHEMA = z.literal(BotNamespace.EMPLOYEE_ADD);

const GITLAB_USER_ID_SCHEMA = z
  .string()
  .regex(/^[1-9]\d{0,9}$/)
  .transform(Number);

const CANDIDATE_SCHEMA = z.object({
  id: z.number().int().positive(),
  username: z.string().min(1),
  name: z.string().min(1),
});

export const EMPLOYEE_ADD_BUTTON_SCHEMA = z.union([
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(EmployeeAddAction.START)])
    .transform(([, action]) => ({ action })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(EmployeeAddAction.PICK), GITLAB_USER_ID_SCHEMA])
    .transform(([, action, gitlabUserId]) => ({ action, gitlabUserId })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(EmployeeAddAction.ROLE), z.enum(JobRole)])
    .transform(([, action, role]) => ({ action, role })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(EmployeeAddAction.GENDER), z.enum(Gender)])
    .transform(([, action, gender]) => ({ action, gender })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(EmployeeAddAction.CANCEL)])
    .transform(([, action]) => ({ action })),
]);

export const EMPLOYEE_ADD_DRAFT_SCHEMA = z.object({
  candidates: z.array(CANDIDATE_SCHEMA).optional(),
  candidate: CANDIDATE_SCHEMA.optional(),
  role: z.enum(JobRole).optional(),
});
