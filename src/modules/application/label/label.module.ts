import { Module } from '@nestjs/common';
import { LabelRepository } from './label.repository';
import { LabelService } from './label.service';

@Module({
  providers: [LabelService, LabelRepository],
  exports: [LabelService],
})
export class LabelModule {}
