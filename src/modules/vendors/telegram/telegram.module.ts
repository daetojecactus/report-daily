import { Module } from '@nestjs/common';
import { TelegramClient } from './telegram.client';
import { TelegramFormatter } from './telegram.formatter';
import { TelegramRenderer } from './telegram.renderer';
import { TelegramRepository } from './telegram.repository';
import { TelegramService } from './telegram.service';

@Module({
  providers: [
    TelegramClient,
    TelegramRepository,
    TelegramFormatter,
    TelegramRenderer,
    TelegramService,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
