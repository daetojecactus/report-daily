import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { UserService } from '../user/user.service';
import { AuthMessages } from './constants/auth.messages';
import { UserStatus } from '../user/user.interface';
import { ActivateInvitePayload, InviteInput } from './auth.interface';
import { User } from '../user/user.schema';
import { InviteService } from './invite/invite.service';
import { InviteMessages } from './invite/constants/invite.messages';
import { UserMessages } from '../user/constants/user.messages';

/**
 * Время жизни invite-кода в часах
 * После этого времени код автоматически удаляется из БД (TTL индекс)
 */
const INVITE_TTL_HOURS = 48;

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
 * 2. Активация invite-кода и создание пользователя
 * 3. Валидация пользователя по telegramId
 *
 * Флоу регистрации:
 * 1. Админ вызывает createInvite({ adminId: 'gitlab_username', role: 'Developer' })
 * 2. Система генерит код и возвращает ссылку t.me/bot?start=CODE
 * 3. Сотрудник переходит по ссылке и нажимает Start
 * 4. Бот получает /start CODE, вызывает activateInvite({ code, telegramId })
 * 5. Создаётся user, код удаляется
 * 6. Сотрудник может пользоваться ботом
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly inviteService: InviteService,
    private readonly userService: UserService,
  ) {}

  /**
   * Создать invite-код для нового сотрудника
   *
   * @param adminId - GitLab username сотрудника (для генерации отчётов)
   * @returns объект с кодом, сроком действия и ссылкой для Telegram
   *
   * Пример:
   * const invite = await authService.createInvite('ivanov');
   * });
   * // => {
   * //   code: 'a1b2c3...',
   * //   expiresAt: 2024-01-03T12:00:00.000Z,
   * //   link: 'https://t.me/mybot?start=a1b2c3...'
   * // }
   */
  async createInvite(input: InviteInput) {
    // Генерируем криптографически стойкий случайный код
    // randomBytes безопаснее чем Math.random()
    const code = randomBytes(INVITE_CODE_LENGTH).toString('hex');

    //время истечения
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

    //cохраняем код в базу
    //todo возможно updateOne {upsert: true}
    const invite = await this.inviteService.create({
      code,
      adminId: input.adminId,
      role: input.role,
      expiresAt,
      used: false,
    });

    return {
      code: invite.code,
      expiresAt: invite.expiresAt,
      // Ссылка с deep link для Telegram
      // Когда пользователь перейдёт, бот получит /start CODE
      link: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${invite.code}`,
    };
  }

  /**
   * Активировать invite-код и создать пользователя
   *
   * Вызывается когда сотрудник переходит по ссылке и нажимает Start
   * Бот получает команду /start CODE и вызывает этот метод
   *
   * @param payload.code - invite-код из команды /start
   * @param payload.telegramId - Telegram ID пользователя (из message.from.id)
   * @returns созданный объект User
   * @throws BadRequestException если код невалидный, истёк или уже использован
   */
  async activateInvite(payload: ActivateInvitePayload) {
    //ищем неиспользованный invite по коду
    const invite = await this.inviteService.findOne({
      code: payload.code,
      used: false,
    });

    //код не найден или уже использован
    if (!invite) {
      throw new BadRequestException(InviteMessages.INVITE_NOT_FOUND);
    }

    //проверяем срок действия
    //даже если TTL не успел удалить документ, мы проверяем вручную
    if (invite.expiresAt < new Date()) {
      //удаляем просроченный код
      await this.inviteService.deleteOne({ code: payload.code });
      throw new BadRequestException(InviteMessages.INVITE_EXPIRED);
    }

    // Дополнительная проверка (на случай race condition)
    //todo убедится надо ли
    if (invite.used) {
      throw new BadRequestException(InviteMessages.INVITE_ALREADY_USED);
    }

    //Создвем пользователя с данными из invite
    //telegramId приходит из Telegram, его нельзя подделать
    const user = await this.userService.create({
      adminId: invite.adminId,
      telegramId: payload.telegramId,
      status: UserStatus.ACTIVE,
      role: invite.role,
      //настройки по умолчанию для нового пользователя
      settings: {
        skipAI: false,
        skipGitLab: false,
      },
    });

    // Удаляем использованный код
    // Одноразовый код - повторно использовать нельзя
    await this.inviteService.deleteOne({ code: payload.code });

    return user;
  }

  /**
   * Валидировать пользователя по Telegram ID
   *
   * Используется в TelegramGuard для проверки каждого запроса
   * Проверяет что пользователь существует и активен
   *
   * @param telegramId - Telegram ID пользователя
   * @returns объект User если валидация успешна
   * @throws ForbiddenException если пользователь не найден или заблокирован
   */
  async validateTelegramUser(telegramId: number) {
    // Базовая проверка telegramId
    if (!telegramId || telegramId <= 0) {
      throw new ForbiddenException(AuthMessages.AUTH_INVALID_TELEGRAM_ID);
    }

    // Ищем пользователя в БД
    const user = await this.userService.findOne({ telegramId });

    // Пользователь не зарегистрирован
    if (!user) {
      throw new ForbiddenException(AuthMessages.AUTH_ACCESS_DENIED);
    }

    // Пользователь заблокирован администратором
    if (user.status === UserStatus.BLOCKED) {
      throw new ForbiddenException(UserMessages.USER_BLOCKED);
    }

    // Пользователь не активен (pending или другой статус)
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(UserMessages.USER_NOT_ACTIVE);
    }

    return user;
  }

  /**
   * Проверить, зарегистрирован ли пользователь
   *
   * Быстрая проверка без выбрасывания исключений
   * Используется для определения нужно ли показывать форму регистрации
   *
   * @param telegramId - Telegram ID пользователя
   * @returns true если пользователь существует в БД
   */
  async isRegistered(telegramId: number) {
    const user = await this.userService.findOne({ telegramId });
    return !!user;
  }
}
