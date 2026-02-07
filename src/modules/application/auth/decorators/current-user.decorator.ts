import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../user/user.schema';

/**
 * CurrentUser - декоратор для получения текущего пользователя в контроллере
 *
 * Как работает:
 * 1. TelegramGuard проверяет telegramId и находит пользователя в БД
 * 2. TelegramGuard прокидывает user в request.user
 * 3. Этот декоратор достаёт user из request и возвращает в параметр метода
 *
 * Использование:
 * @UseGuards(TelegramGuard)
 * @Post('report')
 * generate(@CurrentUser() user: User) {
 *   // user - объект пользователя из БД
 *   console.log(user.adminId);      // GitLab username
 *   console.log(user.telegramId);   // Telegram ID
 *   console.log(user.role);         // Роль
 *   console.log(user.settings);     // Настройки
 * }
 *
 * ВАЖНО: Этот декоратор работает ТОЛЬКО с TelegramGuard
 * Если guard не применён, user будет undefined
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    // Получаем HTTP request из контекста
    const request = ctx.switchToHttp().getRequest();

    // Возвращаем user, который был прокинут TelegramGuard'ом
    return request.user;
  },
);
