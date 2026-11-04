import { Module } from '@nestjs/common';
import { TelegramClient } from './telegram.client';
import { TelegramFormatter } from './telegram.formatter';
import { TelegramRenderer } from './telegram.renderer';
import { TelegramService } from './telegram.service';

@Module({
  providers: [
    TelegramClient,
    TelegramFormatter,
    TelegramRenderer,
    TelegramService,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
