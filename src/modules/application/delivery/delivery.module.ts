import { Module } from '@nestjs/common';
import { DeliveryRepository } from './delivery.repository';
import { DeliveryService } from './delivery.service';

@Module({
  providers: [DeliveryService, DeliveryRepository],
  exports: [DeliveryService],
})
export class DeliveryModule {}
