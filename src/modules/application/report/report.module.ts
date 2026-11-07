import { Module } from '@nestjs/common';
import { TraitModule } from 'src/modules/application/trait/trait.module';
import { ActivityCodeDetector } from './activity/activity-code.detector';
import { ActivityLifecycleDetector } from './activity/activity-lifecycle.detector';
import { ActivityChains } from './activity/activity.chains';
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
    ActivityLifecycleDetector,
    ActivityCodeDetector,
    ActivityChains,
    ActivitySelector,
  ],
  exports: [ClassificationBuilder],
})
export class ReportModule {}
