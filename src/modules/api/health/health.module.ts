import { Module } from '@nestjs/common';
import { SystemModule } from 'src/modules/application/system/system.module';
import { HealthController } from './health.controller';

@Module({
  imports: [SystemModule],
  controllers: [HealthController],
})
export class HealthModule {}
