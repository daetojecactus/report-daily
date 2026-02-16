import { Module } from '@nestjs/common';
import { ReportController } from './report/report.controller';
import { TelegramWebhookController } from './telegram/telegram.controller';
import { TelegramPollingService } from './telegram/telegram-polling.service';
import { ApplicationModule } from '../application/application.module';
import { VendorModule } from '../vendors/vendor.module';

@Module({
  imports: [ApplicationModule, VendorModule],
  controllers: [ReportController, TelegramWebhookController],
  providers: [TelegramPollingService],
})
export class ApiModule {}
