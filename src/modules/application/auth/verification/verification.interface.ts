import { UserRole } from '../../user/user.interface';

export interface CreateVerificationInput {
  telegramId: number;
  email: string;
  adminId: string;
  role: UserRole;
}

export interface VerifyCodeInput {
  telegramId: number;
  code: string;
}
