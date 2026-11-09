import { Module } from '@nestjs/common';
import { TraitRepository } from './trait.repository';
import { TraitService } from './trait.service';
import { TraitNameRepository } from './trait-name/trait-name.repository';
import { TraitNameService } from './trait-name/trait-name.service';

@Module({
  providers: [TraitService, TraitRepository, TraitNameService, TraitNameRepository],
  exports: [TraitService, TraitNameService],
})
export class TraitModule {}
