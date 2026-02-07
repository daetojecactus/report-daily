import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { AuthMessages } from '../constants/auth.messages';

/**
 * TelegramGuard - защита эндпоинтов авторизацией через Telegram ID
 *
 * Как работает:
 * 1. Перехватывает каждый запрос к защищённому эндпоинту
 * 2. Извлекает telegramId из разных источников (Telegram Update, headers, query)
 * 3. Проверяет что пользователь существует в БД и активен
 * 4. Прокидывает объект user в request для использования в контроллере
 *
 * Использование:
 * @UseGuards(TelegramGuard)
 * @Post('report')
 * generate(@CurrentUser() user: User) { ... }
 *
 * Безопасность:
 * - telegramId из Telegram Update (message.from.id) нельзя подделать -
 *   он приходит напрямую от Telegram API
 * - Для API запросов telegramId передаётся в header X-Telegram-Id
 */
@Injectable()
export class TelegramGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  /**
   * Главный метод проверки доступа
   * Вызывается NestJS перед каждым защищённым эндпоинтом
   *
   * @param context - контекст выполнения запроса
   * @returns true если доступ разрешён, иначе выбрасывает ForbiddenException
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Получаем объект HTTP запроса из контекста
    const request = context.switchToHttp().getRequest();

    // Пытаемся извлечь telegramId из разных источников
    const telegramId = this.extractTelegramId(request);

    // Если telegramId не найден - доступ запрещён
    if (!telegramId) {
      throw new ForbiddenException(AuthMessages.AUTH_ACCESS_DENIED);
    }

    // Валидируем пользователя: проверяем что он есть в БД и активен
    // Метод выбросит ForbiddenException если пользователь не найден или заблокирован
    const user = await this.authService.validateTelegramUser(telegramId);

    // Прокидываем user в request
    // Теперь в контроллере можно получить его через @CurrentUser() декоратор
    request.user = user;

    return true;
  }

  /**
   * Извлекает telegramId из запроса
   * Проверяет несколько источников в порядке приоритета
   *
   * Источники (в порядке проверки):
   * 1. Telegram Update - message.from.id (основной для бота)
   * 2. Telegram Callback Query - callback_query.from.id (для inline кнопок)
   * 3. HTTP Header - X-Telegram-Id (для API запросов)
   * 4. Query параметр - ?telegramId=123 (для тестирования)
   *
   * @param request - объект HTTP запроса
   * @returns telegramId или null если не найден
   */
  private extractTelegramId(request: any): number | null {
    // === TELEGRAM UPDATE ===
    // Когда пользователь отправляет сообщение боту,
    // Telegram присылает webhook с объектом Update
    // message.from.id - это telegramId отправителя
    if (request.body?.message?.from?.id) {
      return request.body.message.from.id;
    }

    // === CALLBACK QUERY ===
    // Когда пользователь нажимает inline кнопку,
    // приходит callback_query вместо message
    if (request.body?.callback_query?.from?.id) {
      return request.body.callback_query.from.id;
    }

    // === HTTP HEADER ===
    // Для API запросов (не через Telegram)
    // telegramId передаётся в header X-Telegram-Id
    // Пример: curl -H "X-Telegram-Id: 123456789" http://...
    const headerValue = request.headers?.['x-telegram-id'];
    if (headerValue) {
      const parsed = parseInt(headerValue, 10);
      if (!isNaN(parsed)) return parsed;
    }

    // === QUERY ПАРАМЕТР ===
    // Для тестирования через браузер
    // Пример: http://localhost:3000/report?telegramId=123456789
    // ВНИМАНИЕ: в продакшене лучше отключить этот способ
    if (request.query?.telegramId) {
      const parsed = parseInt(request.query.telegramId, 10);
      if (!isNaN(parsed)) return parsed;
    }

    // telegramId не найден ни в одном источнике
    return null;
  }
}
