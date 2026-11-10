import { Module } from '@nestjs/common';
import { DeliveryModule } from 'src/modules/application/delivery/delivery.module';
import { ReportModule } from 'src/modules/application/report/report.module';
import { SystemCleanup } from './system.cleanup';
import { SystemService } from './system.service';

@Module({
  imports: [ReportModule, DeliveryModule],
  providers: [SystemService, SystemCleanup],
  exports: [SystemService, SystemCleanup],
})
export class SystemModule {}
