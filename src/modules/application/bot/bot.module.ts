import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import type { ChatChannel } from 'src/common/interfaces/chat-channel.interface';
import { AiModule } from 'src/modules/application/ai/ai.module';
import { I18nModule } from 'src/modules/application/i18n/i18n.module';
import { ReportModule } from 'src/modules/application/report/report.module';
import { SettingsModule } from 'src/modules/application/settings/settings.module';
import { TraitModule } from 'src/modules/application/trait/trait.module';
import { UserModule } from 'src/modules/application/user/user.module';
import { GitLabModule } from 'src/modules/vendors/gitlab/gitlab.module';
import { TelegramModule } from 'src/modules/vendors/telegram/telegram.module';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { DeliveryTelegramQueueModule } from 'src/modules/queue/delivery-telegram/delivery-telegram-queue.module';
import { ReportQueueModule } from 'src/modules/queue/report/report-queue.module';
import { AccessService } from './access/access.service';
import { AdminHandler } from './admin/admin.handler';
import { AdminSettingsHandler } from './admin-settings/admin-settings.handler';
import { BroadcastHandler } from './broadcast/broadcast.handler';
import { BotService } from './bot.service';
import { BOT_CHANNELS } from './constants/bot.constants';
import { DialogService } from './dialog/dialog.service';
import { EmployeeAddHandler } from './employee-add/employee-add.handler';
import { EmployeeBindHandler } from './employee-bind/employee-bind.handler';
import { EmployeeManageHandler } from './employee-manage/employee-manage.handler';
import { EmployeePermissionsHandler } from './employee-permissions/employee-permissions.handler';
import { EmployeesCard } from './employees/employees.card';
import { EmployeesHandler } from './employees/employees.handler';
import { CancelHandler } from './handlers/cancel.handler';
import { HelpHandler } from './handlers/help.handler';
import { TraitAddHandler } from './trait-add/trait-add.handler';
import { TraitManageHandler } from './trait-manage/trait-manage.handler';
import { TraitNamesHandler } from './trait-names/trait-names.handler';
import { TraitsHandler } from './traits/traits.handler';
import { TraitsView } from './traits/traits.view';
import { StartHandler } from './handlers/start.handler';
import { MenuService } from './menu/menu.service';
import { ReportHandler } from './report/report.handler';
import { ReportView } from './report/report.view';
import { SharedTemplatesHandler } from './shared-templates/shared-templates.handler';
import { TemplateAddHandler } from './template-add/template-add.handler';
import { TemplateEditHandler } from './template-edit/template-edit.handler';
import { TemplatesDraft } from './templates/templates.draft';
import { TemplatesHandler } from './templates/templates.handler';
import { RouterService } from './router/router.service';
import { SettingsHandler } from './settings/settings.handler';

@Module({
  imports: [
    DiscoveryModule,
    I18nModule,
    TraitModule,
    UserModule,
    GitLabModule,
    TelegramModule,
    ReportModule,
    ReportQueueModule,
    SettingsModule,
    AiModule,
    DeliveryTelegramQueueModule,
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
    AdminSettingsHandler,
    BroadcastHandler,
    EmployeesHandler,
    EmployeesCard,
    EmployeeAddHandler,
    EmployeeBindHandler,
    EmployeeManageHandler,
    EmployeePermissionsHandler,
    SettingsHandler,
    ReportHandler,
    ReportView,
    TemplatesHandler,
    TemplatesDraft,
    TemplateAddHandler,
    TemplateEditHandler,
    SharedTemplatesHandler,
    TraitsHandler,
    TraitAddHandler,
    TraitManageHandler,
    TraitNamesHandler,
    TraitsView,
    {
      provide: BOT_CHANNELS,
      useFactory: (telegramService: TelegramService): ChatChannel[] => [telegramService],
      inject: [TelegramService],
    },
  ],
  exports: [BotService, ReportView],
})
export class BotModule {}
