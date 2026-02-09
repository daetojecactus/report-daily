import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { AuthMessages } from '../constants/auth.messages';
import { UserMessages } from '../../user/constants/user.messages';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    //проверяем токен
    //если токена нет или он неверный сразу отказ
    this.validateSecretToken(request);

    //достаем id из тела запроса
    const telegramId = this.extractTelegramId(request);

    if (!telegramId) {
      throw new ForbiddenException(AuthMessages.AUTH_ACCESS_DENIED);
    }

    //валидируем юзера
    const user = await this.authService.validateTelegramUser(telegramId);
    if (!user) {
      throw new ForbiddenException(UserMessages.USER_NOT_FOUND);
    }

    request.user = user;

    return true;
  }

  private validateSecretToken(request: any) {
    const actualToken = request.headers['x-telegram-bot-api-secret-token'];

    //сравнение
    if (
      actualToken !==
      this.configService.get<string>('TELEGRAM_BOT_SECRET_TOKEN')
    ) {
      throw new ForbiddenException(AuthMessages.AUTH_ACCESS_DENIED);
    }
  }

  private extractTelegramId(request: any) {
    const body = request.body;

    //проверяем наличие body
    if (!body) return null;

    //message
    if (body.message?.from?.id) {
      return body.message.from.id;
    }

    //callback_query
    if (body.callback_query?.from?.id) {
      return body.callback_query.from.id;
    }

    //edited_message
    if (body.edited_message?.from?.id) {
      return body.edited_message.from.id;
    }
    return null;
  }
}
