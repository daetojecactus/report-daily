import { Injectable } from '@nestjs/common';
import type { CleanEvent } from 'src/modules/application/source/types/source.interface';
import { ACTIVITY_TARGET_ACTIONS } from './constants/activity.constants';
import type { ActivityAction, ActivityDetail } from './types/activity.enums';
import type { ActivityCandidate, ActivityLineSignals } from './types/activity.interface';

@Injectable()
export class ActivityEventDetector {
  detect({ line }: ActivityLineSignals): ActivityCandidate[] {
    if (!line.event) {
      return [];
    }
    const actions = ACTIVITY_TARGET_ACTIONS[line.event.targetType];
    const candidates = new Map<ActivityAction, ActivityCandidate>();
    for (const event of line.event.events) {
      const found = actions.get(event.actionName);
      if (found) {
        const known = candidates.get(found.action);
        candidates.set(found.action, this.merge(known, found, event));
      }
    }
    return [...candidates.values()];
  }

  private merge(
    known: ActivityCandidate | undefined,
    found: { action: ActivityAction; weight: number; details: ActivityDetail[] },
    event: CleanEvent,
  ): ActivityCandidate {
    const time = Date.parse(event.createdAt);
    return {
      action: found.action,
      weight: found.weight,
      time: Math.max(known?.time ?? 0, time),
      state: null,
      details: [...new Set([...(known?.details ?? []), ...found.details])],
      facts: [],
      parts: [],
    };
  }
}
