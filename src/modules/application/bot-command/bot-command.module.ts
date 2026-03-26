import { Module } from '@nestjs/common';
import { BotCommandService } from './bot-command.service';
import { UserCommandService } from './user-command.service';
import { UserModule } from '../user/user.module';
import { QueueModule } from 'src/modules/queue/queue.module';

@Module({
  imports: [UserModule, QueueModule],
  providers: [BotCommandService, UserCommandService],
  exports: [BotCommandService, UserCommandService],
})
export class BotCommandModule {}
