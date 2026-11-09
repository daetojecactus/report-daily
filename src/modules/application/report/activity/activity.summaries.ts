import { Injectable } from '@nestjs/common';
import {
  ACTIVITY_SUMMARY_ACTIONS,
  ACTIVITY_SUMMARY_MIN_LINES,
} from './constants/activity.constants';
import { ActivityAction } from './activity.enums';
import type { ActivityLine, ActivityResult, ActivitySummary } from './activity.interface';

@Injectable()
export class ActivitySummaries {
  collect(results: ActivityResult[]): ActivitySummary[] {
    const groups = new Map<string, ActivityResult[]>();
    for (const result of results.filter((item) => this.isSummarized(item))) {
      const { action, details } = result.choice.main;
      const key = [this.findProjectId(result.line), action, ...details.toSorted()].join('|');
      groups.set(key, [...(groups.get(key) ?? []), result]);
    }
    return [...groups.values()]
      .filter((group) => group.length >= ACTIVITY_SUMMARY_MIN_LINES)
      .map((group) => ({
        action: group[0].choice.main.action,
        details: group[0].choice.main.details,
        results: group,
      }));
  }

  findProjectId(line: ActivityLine) {
    return (
      line.issue?.projectId ??
      line.mergeRequests.at(0)?.projectId ??
      line.pushes.at(0)?.projectId ??
      line.event?.projectId ??
      null
    );
  }

  private isSummarized({ choice, excluded }: ActivityResult) {
    return (
      !excluded &&
      ACTIVITY_SUMMARY_ACTIONS.has(choice.main.action) &&
      choice.secondary.every((candidate) => candidate.action === ActivityAction.STATE_ONLY)
    );
  }
}
