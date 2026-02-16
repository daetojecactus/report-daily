import { Module } from '@nestjs/common';
import { BotCommandService } from './bot-command.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  providers: [BotCommandService],
  exports: [BotCommandService],
})
export class BotCommandModule {}
