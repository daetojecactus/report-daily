import { Module } from '@nestjs/common';
import { BotModule } from 'src/modules/application/bot/bot.module';
import { I18nModule } from 'src/modules/application/i18n/i18n.module';
import { ReportModule } from 'src/modules/application/report/report.module';
import { InboundQueueModule } from './inbound/inbound-queue.module';
import { InboundQueueProcessor } from './inbound/inbound-queue.processor';
import { ReportQueueModule } from './report/report-queue.module';
import { ReportQueueProcessor } from './report/report-queue.processor';

@Module({
  imports: [InboundQueueModule, ReportQueueModule, BotModule, ReportModule, I18nModule],
  providers: [InboundQueueProcessor, ReportQueueProcessor],
})
export class QueueModule {}
