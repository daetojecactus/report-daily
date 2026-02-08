import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { UserService } from '../user/user.service';
import { AuthMessages } from './constants/auth.messages';
import { UserStatus } from '../user/user.interface';
import {
  ActivateInvitePayload,
  InviteInput,
  VerifyEmailCodePayload,
} from './auth.interface';
import { InviteService } from './invite/invite.service';
import { InviteMessages } from './invite/constants/invite.messages';
import { UserMessages } from '../user/constants/user.messages';
import { VerificationService } from './verification/verification.service';
import { VerificationMessages } from './verification/constants/verification.messages';

/**
 * Длина invite-кода в байтах
 * 32 байта = 64 символа в hex представлении
 * Это криптографически стойкий случайный код
 */
const INVITE_CODE_LENGTH = 32;

/**
 * AuthService - сервис авторизации и управления invite-кодами
 *
 * Основные функции:
 * 1. Создание invite-кодов для новых сотрудников
 * 2. Активация invite-кода (первый фактор - Telegram ссылка)
 * 3. Верификация email (второй фактор - код на почту)
 * 4. Валидация пользователя по telegramId
 *
 * Флоу регистрации с 2FA:
 * 1. Админ вызывает createInvite({ adminId, email, role })
 * 2. Система генерит код и возвращает ссылку t.me/bot?start=CODE
 * 3. Сотрудник переходит по ссылке и нажимает Start
 * 4. Бот получает /start CODE, вызывает activateInvite({ code, telegramId })
 * 5. Система отправляет 6-значный код на email, invite удаляется
 * 6. Сотрудник вводит код в Telegram (/verify 123456)
 * 7. Бот вызывает verifyEmailCode({ telegramId, code })
 * 8. При совпадении создаётся user
 * 9. Сотрудник может пользоваться ботом
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly inviteService: InviteService,
    private readonly userService: UserService,
    private readonly verificationService: VerificationService,
  ) {}

  async createInvite(input: InviteInput) {
    //генерируем криптографически стойкий случайный код
    const code = randomBytes(INVITE_CODE_LENGTH).toString('hex');

    //cохраняем код в базу с email для будущей верификации
    const invite = await this.inviteService.create({
      code,
      adminId: input.adminId,
      email: input.email,
      role: input.role,
      createdAt: new Date(),
    });

    return {
      //ссылка для приглашения
      link: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${invite.code}`,
      //email куда будет отправлен код (для информации админу)
      email: input.email,
    };
  }

  /**
   * Активация invite-кода (первый фактор)
   *
   * 1. Проверяет invite
   * 2. Создаёт/перезаписывает верификацию с 6-значным кодом (upsert)
   * 3. Удаляет invite
   * 4. Возвращает код для отправки на email
   *
   * Пользователь создаётся только после verifyEmailCode()
   */
  async activateInvite(payload: ActivateInvitePayload) {
    //ищем неиспользованный invite по коду
    const invite = await this.inviteService.findOne({
      code: payload.code,
    });

    //код не найден или уже использован
    if (!invite) {
      throw new BadRequestException(InviteMessages.INVITE_NOT_FOUND);
    }

    //создаём/перезаписываем верификацию (upsert гарантирует один код)
    const verificationCode = await this.verificationService.createVerification({
      telegramId: payload.telegramId,
      email: invite.email,
      adminId: invite.adminId,
      role: invite.role,
    });

    //удаляем использованный invite
    await this.inviteService.deleteOne({ code: payload.code });

    //возвращаем данные для отправки кода на email
    return {
      email: invite.email,
      verificationCode,
      message: VerificationMessages.VERIFICATION_CODE_SENT,
    };
  }

  /**
   * Верификация кода с email (второй фактор)
   *
   * Проверяет 6-значный код и создаёт пользователя
   *
   * @param payload - telegramId и код
   * @returns созданный user или ошибка
   */
  async verifyEmailCode(payload: VerifyEmailCodePayload) {
    //проверяем код
    const result = await this.verificationService.verifyCode({
      telegramId: payload.telegramId,
      code: payload.code,
    });

    //код неверный
    if (!result.success) {
      return {
        success: false,
        message:
          VerificationMessages.VERIFICATION_INVALID_CODE + result.attemptsLeft,
      };
    }

    //код верный - создаём пользователя
    const verification = result.verification!;

    const user = await this.userService.create({
      adminId: verification.adminId,
      telegramId: payload.telegramId,
      status: UserStatus.ACTIVE,
      role: verification.role,
      settings: {
        skipAI: false,
        skipGitLab: false,
      },
    });

    return {
      success: true,
      user,
      message: VerificationMessages.VERIFICATION_SUCCESS,
    };
  }

  //валидация пользователя по telegramId
  async validateTelegramUser(telegramId: number) {
    //проверка telegramId
    if (!telegramId || telegramId <= 0) {
      throw new ForbiddenException(AuthMessages.AUTH_INVALID_TELEGRAM_ID);
    }

    //ищем пользователя в БД
    const user = await this.userService.findOne({ telegramId });

    //пользователь не зарегистрирован
    if (!user) {
      throw new ForbiddenException(AuthMessages.AUTH_ACCESS_DENIED);
    }

    //пользователь заблокирован администратором
    if (user.status === UserStatus.BLOCKED) {
      throw new ForbiddenException(UserMessages.USER_BLOCKED);
    }

    //пользователь не активен
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(UserMessages.USER_NOT_ACTIVE);
    }

    return user;
  }

  //проверка, зарегистрирован ли пользователь по telegramId
  async isRegistered(telegramId: number) {
    const user = await this.userService.findOne({ telegramId });
    return !!user;
  }
}
