import { Module } from '@nestjs/common';
import { ReportController } from './report/report.controller';
import { ApplicationModule } from '../application/application.module';

@Module({
  imports: [ApplicationModule],
  controllers: [ReportController],
})
export class ApiModule {}
