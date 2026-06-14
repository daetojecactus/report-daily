import type { UserRole } from './user.enums';

export { Language } from '../../../common/i18n/i18n';

export interface CreateUserInput {
  adminId: string;
  telegramId: number;
  role: UserRole;
  reportHour: number;
}
