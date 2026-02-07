import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Invite, InviteSchema } from './invite/invite.schema';
import { AuthService } from './auth.service';
import { TelegramGuard } from './guards/telegram.guard';
import { UserModule } from '../user/user.module';
import { InviteService } from './invite/invite.service';
import { InviteRepository } from './invite/invite.repository';

/**
 * AuthModule - модуль авторизации и безопасности
 *
 * Функции модуля:
 * 1. Управление invite-кодами (создание, активация)
 * 2. Авторизация пользователей по Telegram ID
 * 3. Защита эндпоинтов через TelegramGuard
 *
 * Структура:
 * - AuthService: логика invite-кодов и валидации
 * - InviteService/Repository: CRUD для invite-кодов
 * - TelegramGuard: проверка авторизации на эндпоинтах
 * - CurrentUser decorator: получение user в контроллере
 *
 * Экспортирует:
 * - AuthService: для создания invite и проверки регистрации
 * - TelegramGuard: для защиты эндпоинтов
 *
 * Использование:
 * 1. Импортировать AuthModule в нужный модуль
 * 2. Добавить @UseGuards(TelegramGuard) на контроллер/метод
 * 3. Использовать @CurrentUser() для получения пользователя
 */
@Module({
  imports: [
    // Регистрация схемы Invite в Mongoose
    MongooseModule.forFeature([{ name: Invite.name, schema: InviteSchema }]),

    // forwardRef решает circular dependency между AuthModule и UserModule
    // AuthService зависит от UserService, а UserModule может зависеть от AuthModule
    forwardRef(() => UserModule),
  ],
  providers: [
    // Слой работы с БД
    InviteRepository,

    // Бизнес-логика invite
    InviteService,

    // Главный сервис авторизации
    AuthService,

    // Guard для защиты эндпоинтов
    TelegramGuard,
  ],
  exports: [
    // Экспортируем для использования в других модулях
    AuthService,
    TelegramGuard,
  ],
})
export class AuthModule {}
