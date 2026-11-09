import { Module } from '@nestjs/common';
import { TraitModule } from 'src/modules/application/trait/trait.module';
import { ActivityCodeDetector } from './activity/activity-code.detector';
import { ActivityEventDetector } from './activity/activity-event.detector';
import { ActivityLifecycleDetector } from './activity/activity-lifecycle.detector';
import { ActivityLinkDetector } from './activity/activity-link.detector';
import { ActivityPlanDetector } from './activity/activity-plan.detector';
import { ActivityRefDetector } from './activity/activity-ref.detector';
import { ActivityChains } from './activity/activity.chains';
import { ActivityDetectors } from './activity/activity.detectors';
import { ActivityEngagement } from './activity/activity.engagement';
import { ActivityRules } from './activity/activity.rules';
import { ActivitySelector } from './activity/activity.selector';
import { ActivityService } from './activity/activity.service';
import { ActivitySignals } from './activity/activity.signals';
import { ActivitySummaries } from './activity/activity.summaries';
import { PhraseService } from './phrase/phrase.service';
import { TemplateContext } from './template/template.context';
import { TemplateService } from './template/template.service';

@Module({
  imports: [TraitModule],
  providers: [
    ActivitySignals,
    ActivityRules,
    ActivityEngagement,
    ActivityDetectors,
    ActivityLifecycleDetector,
    ActivityCodeDetector,
    ActivityRefDetector,
    ActivityPlanDetector,
    ActivityLinkDetector,
    ActivityEventDetector,
    ActivityChains,
    ActivitySelector,
    ActivitySummaries,
    ActivityService,
    PhraseService,
    TemplateContext,
    TemplateService,
  ],
  exports: [ActivityService, PhraseService, TemplateContext, TemplateService],
})
export class ReportModule {}
