import { UserGender, UserRole } from '../user.interface';

export interface InviteInput {
  adminId: string;
  email: string;
  role: UserRole;
  gender: UserGender;
}

export interface VerifyEmailCodeInput {
  telegramId: number;
  code: string;
}

export interface ActivateInviteInput {
  code: string;
  telegramId: number;
}
