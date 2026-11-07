import { Injectable } from '@nestjs/common';
import type { GroupedDailyData } from 'src/modules/application/source/source.interface';
import { TaskFlag } from 'src/modules/application/trait/trait.enums';
import type { TraitIndex } from 'src/modules/application/trait/trait.interface';
import { ActivityChains } from './activity.chains';
import { ActivityDetectors } from './activity.detectors';
import type { ActivityEmployee, ActivityLine, ActivityResult } from './activity.interface';
import { ActivitySelector } from './activity.selector';
import { ActivitySignals } from './activity.signals';

@Injectable()
export class ActivityService {
  constructor(
    private readonly activitySignals: ActivitySignals,
    private readonly activityDetectors: ActivityDetectors,
    private readonly activityChains: ActivityChains,
    private readonly activitySelector: ActivitySelector,
  ) {}

  classify(day: GroupedDailyData, employee: ActivityEmployee, index: TraitIndex): ActivityResult[] {
    return this.toLines(day).map((line) => {
      const signals = this.activitySignals.build(line, employee, index);
      const candidates = this.activityChains.combine(
        signals,
        this.activityDetectors.detect(signals),
      );
      return {
        line,
        signals,
        choice: this.activitySelector.select(signals, candidates),
        excluded: signals.endFlags.includes(TaskFlag.EXCLUDE_FROM_REPORT),
      };
    });
  }

  private toLines(day: GroupedDailyData): ActivityLine[] {
    return [
      ...day.issues.map((issue) => ({ issue, mergeRequests: issue.mergeRequests, push: null })),
      ...day.standaloneMergeRequests.map((mergeRequest) => ({
        issue: null,
        mergeRequests: [mergeRequest],
        push: null,
      })),
      ...day.standalonePushes.map((push) => ({ issue: null, mergeRequests: [], push })),
    ];
  }
}
