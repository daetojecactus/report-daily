import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import type { ChatChannel } from 'src/common/interfaces/chat-channel.interface';
import { I18nModule } from 'src/modules/application/i18n/i18n.module';
import { UserModule } from 'src/modules/application/user/user.module';
import { TelegramModule } from 'src/modules/vendors/telegram/telegram.module';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { AccessService } from './access/access.service';
import { BotService } from './bot.service';
import { BOT_CHANNELS } from './constants/bot.constants';
import { DialogService } from './dialog/dialog.service';
import { CancelHandler } from './handlers/cancel.handler';
import { HelpHandler } from './handlers/help.handler';
import { StartHandler } from './handlers/start.handler';
import { MenuService } from './menu/menu.service';
import { RouterService } from './router/router.service';

@Module({
  imports: [DiscoveryModule, I18nModule, UserModule, TelegramModule],
  providers: [
    BotService,
    AccessService,
    RouterService,
    DialogService,
    MenuService,
    StartHandler,
    HelpHandler,
    CancelHandler,
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
