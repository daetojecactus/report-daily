import { UserRole } from '../user/user.interface';

/**
 * Payload для создания invite-кода
 * Передаётся в AuthService.createInvite()
 */
export interface InviteInput {
  /** GitLab username сотрудника (для генерации отчётов) */
  adminId: string;

  /** Корпоративная почта сотрудника (для 2FA верификации) */
  email: string;

  /** Роль в компании: Developer, QA, Project Manager и т.д. */
  role: UserRole;
}

/**
 * Payload для верификации кода с email
 * Передаётся в AuthService.verifyEmailCode()
 */
export interface VerifyEmailCodePayload {
  /** Telegram ID пользователя */
  telegramId: number;

  /** 6-значный код из email */
  code: string;
}

/**
 * Payload для активации invite-кода
 * Передаётся в AuthService.activateInvite()
 */
export interface ActivateInvitePayload {
  /** Invite-код из команды /start CODE */
  code: string;

  /** Telegram ID пользователя (из message.from.id) */
  telegramId: number;
}
