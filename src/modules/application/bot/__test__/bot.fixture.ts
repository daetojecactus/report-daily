import { Channel } from 'src/common/enums/channel.enums';
import {
  Gender,
  JobRole,
  UserStatus,
} from 'src/modules/application/user/user.enums';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import type {
  User,
  UserWithChannel,
} from 'src/modules/application/user/user.interface';

export const OWNER_ID = '100';

export const EMPLOYEE_ID = '200';

export const STRANGER_ID = '300';

export function createEmployee(values: Partial<User> = {}): UserWithChannel {
  const user: User = {
    id: '0190b5a8-0000-7000-8000-000000000001',
    gitlabUserId: 1,
    gitlabUsername: 'ivan',
    displayName: 'Ivan *Petrov*',
    role: JobRole.DEVELOPER,
    gender: Gender.MALE,
    status: UserStatus.ACTIVE,
    language: Language.EN,
    timezone: null,
    reportTime: '18:00:00',
    aiEnabled: true,
    aiDataOptOut: false,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...values,
  };
  return {
    user,
    channel: {
      id: '0190b5a8-0000-7000-8000-000000000002',
      userId: user.id,
      channel: Channel.TELEGRAM,
      externalId: EMPLOYEE_ID,
      reachable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}
