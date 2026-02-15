import { Module } from '@nestjs/common';
import { ReportController } from './report/report.controller';
import { TelegramWebhookController } from './telegram/telegram.controller';
import { ApplicationModule } from '../application/application.module';

@Module({
  imports: [ApplicationModule],
  controllers: [ReportController, TelegramWebhookController],
})
export class ApiModule {}
