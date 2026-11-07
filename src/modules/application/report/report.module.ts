import { Module } from '@nestjs/common';
import { TraitModule } from 'src/modules/application/trait/trait.module';
import { ActivityCodeDetector } from './activity/activity-code.detector';
import { ActivityDetectors } from './activity/activity.detectors';
import { ActivityEngagement } from './activity/activity.engagement';
import { ActivityRules } from './activity/activity.rules';
import { ActivitySelector } from './activity/activity.selector';
import { ActivitySignals } from './activity/activity.signals';
import { ClassificationBuilder } from './classification/classification.builder';

@Module({
  imports: [TraitModule],
  providers: [
    ClassificationBuilder,
    ActivitySignals,
    ActivityRules,
    ActivityEngagement,
    ActivityDetectors,
    ActivityCodeDetector,
    ActivitySelector,
  ],
  exports: [ClassificationBuilder],
})
export class ReportModule {}
