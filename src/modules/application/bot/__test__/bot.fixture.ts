import { Channel } from 'src/common/enums/channel.enums';
import { Gender, JobRole, UserStatus } from 'src/modules/application/user/user.enums';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { Source } from 'src/modules/application/source/source.enums';
import type { User, UserWithChannel } from 'src/modules/application/user/user.interface';
import type { UserSource } from 'src/modules/application/user/user-source/user-source.interface';

export const OWNER_ID = '100';

export const EMPLOYEE_ID = '200';

export const STRANGER_ID = '300';

export function createEmployee(values: Partial<User> = {}): UserWithChannel {
  const user: User = {
    id: '0190b5a8-0000-7000-8000-000000000001',
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
    templateId: null,
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

export function createSourceAccount(values: Partial<UserSource> = {}): UserSource {
  return {
    id: '0190b5a8-0000-7000-8000-000000000003',
    userId: '0190b5a8-0000-7000-8000-000000000001',
    source: Source.GITLAB,
    externalId: '1',
    username: 'ivan',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...values,
  };
}
