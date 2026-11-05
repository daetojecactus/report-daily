import { Module } from '@nestjs/common';
import { TraitRepository } from './trait.repository';
import { TraitService } from './trait.service';

@Module({
  providers: [TraitService, TraitRepository],
  exports: [TraitService],
})
export class TraitModule {}
