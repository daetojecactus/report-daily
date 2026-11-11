import { Injectable } from '@nestjs/common';
import {
  ACTIVITY_ROLE_BONUS,
  ACTIVITY_ROLE_FOCUS,
  ACTIVITY_TIERS,
} from './constants/activity-weights.constants';
import { ActivityAction, ActivityReason, ActivityTier } from './types/activity.enums';
import type {
  ActivityCandidate,
  ActivityChoice,
  ActivityLineSignals,
  ActivityRank,
  ActivityRoleFocus,
} from './types/activity.interface';

@Injectable()
export class ActivitySelector {
  select(signals: ActivityLineSignals, candidates: ActivityCandidate[]): ActivityChoice {
    const focus = ACTIVITY_ROLE_FOCUS[signals.employee.role];
    const ranked = candidates
      .map((candidate) => ({
        candidate,
        tier: this.toTier(candidate.weight),
        weight: candidate.weight + (this.isFocus(candidate, focus) ? ACTIVITY_ROLE_BONUS : 0),
      }))
      .sort(
        (left, right) =>
          this.toLevel(left.tier) - this.toLevel(right.tier) ||
          right.weight - left.weight ||
          right.candidate.time - left.candidate.time,
      );
    const [main, ...rest] = ranked;
    const secondary = rest.filter((rank) => rank.candidate.action !== ActivityAction.STATE_ONLY);
    return {
      main: main.candidate,
      secondary: secondary.map((rank) => rank.candidate),
      trace: {
        ranked,
        reason: this.toReason(main, secondary.at(0)),
        dropped: signals.dropped,
      },
    };
  }

  private toTier(weight: number) {
    return ACTIVITY_TIERS.find(({ from }) => weight >= from)?.tier ?? ActivityTier.CONTEXT;
  }

  private toLevel(tier: ActivityTier) {
    return ACTIVITY_TIERS.findIndex((entry) => entry.tier === tier);
  }

  private isFocus(candidate: ActivityCandidate, focus: ActivityRoleFocus) {
    return (
      focus.actions.includes(candidate.action) ||
      (candidate.action === ActivityAction.STATE_SET &&
        candidate.state !== null &&
        focus.states.includes(candidate.state))
    );
  }

  private toReason(main: ActivityRank, next: ActivityRank | undefined) {
    if (!next) {
      return ActivityReason.ONLY;
    }
    if (next.tier !== main.tier) {
      return ActivityReason.TIER;
    }
    return next.weight === main.weight ? ActivityReason.TIME : ActivityReason.WEIGHT;
  }
}
