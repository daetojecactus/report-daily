import { Module } from '@nestjs/common';
import { BotModule } from 'src/modules/application/bot/bot.module';
import { ReportModule } from 'src/modules/application/report/report.module';
import { UserModule } from 'src/modules/application/user/user.module';
import { SlackModule } from 'src/modules/vendors/slack/slack.module';
import { TelegramModule } from 'src/modules/vendors/telegram/telegram.module';
import { DeliveryQueueModule } from './delivery/delivery-queue.module';
import { DeliverySlackQueueProcessor } from './delivery/delivery-slack-queue.processor';
import { DeliveryTelegramQueueProcessor } from './delivery/delivery-telegram-queue.processor';
import { InboundQueueModule } from './inbound/inbound-queue.module';
import { InboundQueueProcessor } from './inbound/inbound-queue.processor';
import { ReportQueueModule } from './report/report-queue.module';
import { ReportQueueProcessor } from './report/report-queue.processor';

@Module({
  imports: [
    InboundQueueModule,
    ReportQueueModule,
    DeliveryQueueModule,
    BotModule,
    ReportModule,
    UserModule,
    TelegramModule,
    SlackModule,
  ],
  providers: [
    InboundQueueProcessor,
    ReportQueueProcessor,
    DeliveryTelegramQueueProcessor,
    DeliverySlackQueueProcessor,
  ],
})
export class QueueModule {}
