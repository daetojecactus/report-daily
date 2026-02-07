import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramClient } from './telegram.client';
import { TelegramRepository } from './telegram.repository';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ConfigModule],
  providers: [TelegramClient, TelegramRepository, TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
