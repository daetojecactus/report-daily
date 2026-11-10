import { Module } from '@nestjs/common';
import { BotModule } from 'src/modules/application/bot/bot.module';
import { DeliveryModule } from 'src/modules/application/delivery/delivery.module';
import { I18nModule } from 'src/modules/application/i18n/i18n.module';
import { ReportModule } from 'src/modules/application/report/report.module';
import { ScheduleModule } from 'src/modules/application/schedule/schedule.module';
import { SystemModule } from 'src/modules/application/system/system.module';
import { UserModule } from 'src/modules/application/user/user.module';
import { TelegramModule } from 'src/modules/vendors/telegram/telegram.module';
import { DeliveryTelegramQueueModule } from './delivery-telegram/delivery-telegram-queue.module';
import { DeliveryTelegramQueueProcessor } from './delivery-telegram/delivery-telegram-queue.processor';
import { InboundQueueModule } from './inbound/inbound-queue.module';
import { InboundQueueProcessor } from './inbound/inbound-queue.processor';
import { ReportQueueModule } from './report/report-queue.module';
import { ReportQueueProcessor } from './report/report-queue.processor';
import { SystemQueueModule } from './system/system-queue.module';
import { SystemQueueProcessor } from './system/system-queue.processor';

@Module({
  imports: [
    InboundQueueModule,
    ReportQueueModule,
    DeliveryTelegramQueueModule,
    SystemQueueModule,
    BotModule,
    ReportModule,
    DeliveryModule,
    UserModule,
    TelegramModule,
    I18nModule,
    ScheduleModule,
    SystemModule,
  ],
  providers: [
    InboundQueueProcessor,
    ReportQueueProcessor,
    DeliveryTelegramQueueProcessor,
    SystemQueueProcessor,
  ],
})
export class QueueModule {}
