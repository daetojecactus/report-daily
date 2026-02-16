import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { VendorModule } from 'src/modules/vendors/vendor.module';

@Module({
  imports: [VendorModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
