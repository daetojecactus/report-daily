import { Injectable, ForbiddenException } from '@nestjs/common';
import { UserService } from '../user.service';
import { AuthMessages } from './constants/auth.messages';
import { UserStatus } from '../user.interface';
import { UserMessages } from '../constants/user.messages';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

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
