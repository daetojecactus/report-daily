import { Module } from '@nestjs/common';
import { TraitModule } from 'src/modules/application/trait/trait.module';
import { ClassificationBuilder } from './classification/classification.builder';
import { ClassificationResolver } from './classification/classification.resolver';
import { ClassificationService } from './classification/classification.service';
import { DeveloperRules } from './classification/rules/developer.rules';
import { ManagerRules } from './classification/rules/manager.rules';
import { QaInternalRules } from './classification/rules/qa-internal.rules';
import { QaRules } from './classification/rules/qa.rules';

@Module({
  imports: [TraitModule],
  providers: [
    ClassificationService,
    ClassificationBuilder,
    ClassificationResolver,
    DeveloperRules,
    QaRules,
    QaInternalRules,
    ManagerRules,
  ],
  exports: [ClassificationService],
})
export class ReportModule {}
