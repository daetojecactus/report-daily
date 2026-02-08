import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Invite, InviteSchema } from './invite/invite.schema';
import {
  Verification,
  VerificationSchema,
} from './verification/verification.schema';
import { AuthService } from './auth.service';
import { TelegramGuard } from './guards/telegram.guard';
import { UserModule } from '../user/user.module';
import { InviteService } from './invite/invite.service';
import { InviteRepository } from './invite/invite.repository';
import { VerificationService } from './verification/verification.service';
import { VerificationRepository } from './verification/verification.repository';
import { CryptoModule } from 'src/modules/vendors/crypto/crypto.module';

/**
 * AuthModule - модуль авторизации и безопасности
 *
 * Функции модуля:
 * 1. Управление invite-кодами (создание, активация)
 * 2. 2FA верификация через email (6-значный код)
 * 3. Авторизация пользователей по Telegram ID
 * 4. Защита эндпоинтов через TelegramGuard
 *
 * Структура:
 * - AuthService: логика invite-кодов, верификации и валидации
 * - InviteService/Repository: CRUD для invite-кодов
 * - VerificationService/Repository: 2FA коды на email
 * - TelegramGuard: проверка авторизации на эндпоинтах
 * - CurrentUser decorator: получение user в контроллере
 *
 * Флоу регистрации с 2FA:
 * 1. Админ создаёт invite с email сотрудника
 * 2. Сотрудник переходит по ссылке в Telegram
 * 3. Система отправляет 6-значный код на email
 * 4. Сотрудник вводит код в Telegram (/verify CODE)
 * 5. При совпадении создаётся пользователь
 *
 * Экспортирует:
 * - AuthService: для создания invite и проверки регистрации
 * - TelegramGuard: для защиты эндпоинтов
 */
@Module({
  imports: [
    // Регистрация схем в Mongoose
    MongooseModule.forFeature([
      { name: Invite.name, schema: InviteSchema },
      { name: Verification.name, schema: VerificationSchema },
    ]),

    // forwardRef решает circular dependency между AuthModule и UserModule
    forwardRef(() => UserModule),
    CryptoModule,
  ],
  providers: [
    // Слой работы с БД
    InviteRepository,
    VerificationRepository,

    // Бизнес-логика
    InviteService,
    VerificationService,

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
