import { Module } from '@nestjs/common';
import { BotModule } from 'src/modules/application/bot/bot.module';
import { DeliveryModule } from 'src/modules/application/delivery/delivery.module';
import { I18nModule } from 'src/modules/application/i18n/i18n.module';
import { ReportModule } from 'src/modules/application/report/report.module';
import { UserModule } from 'src/modules/application/user/user.module';
import { TelegramModule } from 'src/modules/vendors/telegram/telegram.module';
import { DeliveryTelegramQueueModule } from './delivery-telegram/delivery-telegram-queue.module';
import { DeliveryTelegramQueueProcessor } from './delivery-telegram/delivery-telegram-queue.processor';
import { InboundQueueModule } from './inbound/inbound-queue.module';
import { InboundQueueProcessor } from './inbound/inbound-queue.processor';
import { ReportQueueModule } from './report/report-queue.module';
import { ReportQueueProcessor } from './report/report-queue.processor';

@Module({
  imports: [
    InboundQueueModule,
    ReportQueueModule,
    DeliveryTelegramQueueModule,
    BotModule,
    ReportModule,
    DeliveryModule,
    UserModule,
    TelegramModule,
    I18nModule,
  ],
  providers: [InboundQueueProcessor, ReportQueueProcessor, DeliveryTelegramQueueProcessor],
})
export class QueueModule {}
