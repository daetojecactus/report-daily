import { Injectable } from '@nestjs/common';
import type { GroupedDailyData } from 'src/modules/application/source/types/source.interface';
import { TaskFlag } from 'src/modules/application/trait/types/trait.enums';
import type { TraitIndex } from 'src/modules/application/trait/types/trait.interface';
import { ActivityChains } from './activity.chains';
import { ActivityDetectors } from './activity.detectors';
import { ACTIVITY_EXCLUDING_RULES } from './constants/activity.constants';
import { ActivityAction } from './types/activity.enums';
import type { ActivityEmployee, ActivityLine, ActivityResult } from './types/activity.interface';
import { ActivitySelector } from './activity.selector';
import { ActivitySignals } from './activity.signals';
import { ActivitySummaries } from './activity.summaries';

@Injectable()
export class ActivityService {
  constructor(
    private readonly activitySignals: ActivitySignals,
    private readonly activityDetectors: ActivityDetectors,
    private readonly activityChains: ActivityChains,
    private readonly activitySelector: ActivitySelector,
    private readonly activitySummaries: ActivitySummaries,
  ) {}

  summarize(results: ActivityResult[]) {
    return this.activitySummaries.collect(results);
  }

  findProjectId(line: ActivityLine) {
    return this.activitySummaries.findProjectId(line);
  }

  classify(day: GroupedDailyData, employee: ActivityEmployee, index: TraitIndex): ActivityResult[] {
    return this.toLines(day).map((line) => {
      const signals = this.activitySignals.build(line, employee, index);
      const candidates = this.activityChains.combine(
        signals,
        this.activityDetectors.detect(signals),
      );
      const choice = this.activitySelector.select(signals, candidates);
      return {
        line,
        signals,
        choice,
        excluded:
          signals.endFlags.includes(TaskFlag.EXCLUDE_FROM_REPORT) ||
          (choice.main.action === ActivityAction.STATE_ONLY &&
            signals.dropped.some(({ rule }) => ACTIVITY_EXCLUDING_RULES.has(rule))),
      };
    });
  }

  private toLines(day: GroupedDailyData): ActivityLine[] {
    return [
      ...day.issues.map((issue) => ({
        issue,
        mergeRequests: issue.mergeRequests,
        pushes: issue.pushes,
        event: null,
      })),
      ...day.standaloneMergeRequests.map((mergeRequest) => ({
        issue: null,
        mergeRequests: [mergeRequest],
        pushes: [],
        event: null,
      })),
      ...day.standalonePushes.map((push) => ({
        issue: null,
        mergeRequests: [],
        pushes: [push],
        event: null,
      })),
      ...day.standaloneEvents.map((event) => ({
        issue: null,
        mergeRequests: [],
        pushes: [],
        event,
      })),
    ];
  }
}
