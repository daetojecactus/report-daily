import { UserGender, UserRole } from '../../user.interface';

export interface CreateVerificationInput {
  telegramId: number;
  email: string;
  adminId: string;
  role: UserRole;
  gender: UserGender;
}

export interface VerifyCodeInput {
  telegramId: number;
  code: string;
}
