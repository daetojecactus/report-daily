import { Module } from '@nestjs/common';
import { ReportController } from './report/report.controller';
import { TelegramWebhookController } from './telegram/telegram.controller';
import { TelegramPollingService } from './telegram/telegram-polling.service';
import { TelegramCommandRouter } from './telegram/telegram-command-router.service';
import { ApplicationModule } from '../application/application.module';
import { VendorModule } from '../vendors/vendor.module';

@Module({
  imports: [ApplicationModule, VendorModule],
  controllers: [ReportController, TelegramWebhookController],
  providers: [TelegramCommandRouter, TelegramPollingService],
})
export class ApiModule {}
