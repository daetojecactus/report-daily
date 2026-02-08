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
  ActivateInviteInput,
  InviteInput,
  VerifyEmailCodeInput,
} from './auth.interface';
import { InviteService } from './invite/invite.service';
import { InviteMessages } from './invite/constants/invite.messages';
import { UserMessages } from '../user/constants/user.messages';
import { VerificationService } from './verification/verification.service';
import { VerificationMessages } from './verification/constants/verification.messages';
import { AUTH_INVITE_CODE_LENGTH } from './constants/auth.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly inviteService: InviteService,
    private readonly userService: UserService,
    private readonly verificationService: VerificationService,
  ) {}

  //создание invite-кода админом
  async createInvite(input: InviteInput) {
    //генерируем криптографически стойкий случайный код
    const code = randomBytes(AUTH_INVITE_CODE_LENGTH).toString('hex');

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

  //активация invite-кода (первый фактор)
  async activateInvite(input: ActivateInviteInput) {
    //ищем неиспользованный invite по коду
    const invite = await this.inviteService.findOne({
      code: input.code,
    });

    //код не найден или уже использован
    if (!invite) {
      throw new BadRequestException(InviteMessages.INVITE_NOT_FOUND);
    }

    //создаем код для верификации email (второй фактор)
    const verificationCode = await this.verificationService.createVerification({
      telegramId: input.telegramId,
      email: invite.email,
      adminId: invite.adminId,
      role: invite.role,
    });

    //возвращаем данные для отправки кода на email
    return {
      email: invite.email,
      verificationCode,
      message: VerificationMessages.VERIFICATION_CODE_SENT,
    };
  }

  //верификация кода с email (второй фактор)
  async verifyEmailCode(input: VerifyEmailCodeInput) {
    //проверяем код
    const result = await this.verificationService.verifyCode({
      telegramId: input.telegramId,
      code: input.code,
    });

    //код неверный
    if (!result.success || !result.verification) {
      return {
        success: false,
        message:
          VerificationMessages.VERIFICATION_INVALID_CODE + result.attemptsLeft,
      };
    }

    //создаем пользователя
    const user = await this.userService.create({
      adminId: result.verification.adminId,
      telegramId: input.telegramId,
      email: result.verification.email,
      status: UserStatus.ACTIVE,
      role: result.verification.role,
      settings: {
        skipAI: false,
        skipGitLab: false,
      },
    });

    //удаляем код приглашения, второй фактор пройден
    await this.inviteService.deleteOne({
      adminId: result.verification.adminId,
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
}
