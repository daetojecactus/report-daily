import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import type { ChatChannel } from 'src/common/interfaces/chat-channel.interface';
import { I18nModule } from 'src/modules/application/i18n/i18n.module';
import { UserModule } from 'src/modules/application/user/user.module';
import { GitLabModule } from 'src/modules/vendors/gitlab/gitlab.module';
import { TelegramModule } from 'src/modules/vendors/telegram/telegram.module';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { AccessService } from './access/access.service';
import { AdminHandler } from './admin/admin.handler';
import { BotService } from './bot.service';
import { BOT_CHANNELS } from './constants/bot.constants';
import { DialogService } from './dialog/dialog.service';
import { EmployeeAddHandler } from './employee-add/employee-add.handler';
import { EmployeeBindHandler } from './employee-bind/employee-bind.handler';
import { EmployeeManageHandler } from './employee-manage/employee-manage.handler';
import { EmployeePermissionsHandler } from './employee-permissions/employee-permissions.handler';
import { EmployeesHandler } from './employees/employees.handler';
import { CancelHandler } from './handlers/cancel.handler';
import { HelpHandler } from './handlers/help.handler';
import { StartHandler } from './handlers/start.handler';
import { MenuService } from './menu/menu.service';
import { RouterService } from './router/router.service';

@Module({
  imports: [
    DiscoveryModule,
    I18nModule,
    UserModule,
    GitLabModule,
    TelegramModule,
  ],
  providers: [
    BotService,
    AccessService,
    RouterService,
    DialogService,
    MenuService,
    StartHandler,
    HelpHandler,
    CancelHandler,
    AdminHandler,
    EmployeesHandler,
    EmployeeAddHandler,
    EmployeeBindHandler,
    EmployeeManageHandler,
    EmployeePermissionsHandler,
    {
      provide: BOT_CHANNELS,
      useFactory: (telegramService: TelegramService): ChatChannel[] => [
        telegramService,
      ],
      inject: [TelegramService],
    },
  ],
  exports: [BotService],
})
export class BotModule {}
