import { Module } from '@nestjs/common';
import { BotCommandService } from './bot-command.service';
import { BotCommandSetupService } from './bot-command-setup.service';
import { UserCommandService } from './user-command.service';
import { AddUserService } from './add-user/add-user.service';
import { BroadcastService } from './broadcast/broadcast.service';
import { UserAdminService } from './user-admin/user-admin.service';
import { TelegramCommandRouter } from './router/telegram-command-router.service';
import { UserModule } from '../user/user.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { QueueModule } from 'src/modules/queue/queue.module';
import { VendorModule } from 'src/modules/vendors/vendor.module';

@Module({
  imports: [UserModule, SchedulerModule, QueueModule, VendorModule],
  providers: [
    BotCommandService,
    BotCommandSetupService,
    UserCommandService,
    AddUserService,
    BroadcastService,
    UserAdminService,
    TelegramCommandRouter,
  ],
  exports: [
    BotCommandService,
    BotCommandSetupService,
    UserCommandService,
    TelegramCommandRouter,
  ],
})
export class BotCommandModule {}
