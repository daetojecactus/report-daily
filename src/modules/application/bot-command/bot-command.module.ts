import { Module } from '@nestjs/common';
import { BotCommandService } from './bot-command.service';
import { BotCommandSetupService } from './bot-command-setup.service';
import { UserCommandService } from './user-command.service';
import { UserModule } from '../user/user.module';
import { QueueModule } from 'src/modules/queue/queue.module';
import { VendorModule } from 'src/modules/vendors/vendor.module';

@Module({
  imports: [UserModule, QueueModule, VendorModule],
  providers: [BotCommandService, BotCommandSetupService, UserCommandService],
  exports: [BotCommandService, BotCommandSetupService, UserCommandService],
})
export class BotCommandModule {}
