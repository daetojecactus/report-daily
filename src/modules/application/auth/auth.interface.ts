import { UserRole } from '../user/user.interface';

export interface InviteInput {
  adminId: string;
  email: string;
  role: UserRole;
}

export interface VerifyEmailCodeInput {
  telegramId: number;
  code: string;
}

export interface ActivateInviteInput {
  code: string;
  telegramId: number;
}
