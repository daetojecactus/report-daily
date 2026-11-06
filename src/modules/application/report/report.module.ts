import { Module } from '@nestjs/common';
import { TraitModule } from 'src/modules/application/trait/trait.module';
import { ClassificationBuilder } from './classification/classification.builder';

@Module({
  imports: [TraitModule],
  providers: [ClassificationBuilder],
  exports: [ClassificationBuilder],
})
export class ReportModule {}
