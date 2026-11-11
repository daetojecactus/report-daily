import { Injectable } from '@nestjs/common';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import { ACTIVITY_PLAN_FACTS } from '../constants/activity-facts.constants';
import { ACTIVITY_WEIGHTS } from '../constants/activity-weights.constants';
import { ActivityAction, ActivityDetail } from '../types/activity.enums';
import type {
  ActivityCandidate,
  ActivityFact,
  ActivityLine,
  ActivityLineSignals,
} from '../types/activity.interface';

@Injectable()
export class ActivityPlanDetector {
  detect({ own, line }: ActivityLineSignals): ActivityCandidate[] {
    const plans = own.filter((fact) => ACTIVITY_PLAN_FACTS.has(fact.kind));
    const estimates = own.filter((fact) => fact.kind === SourceActionKind.WEIGHT_SET);
    const weightAtStart = line.issue?.startOfDay.weight ?? null;
    return [
      this.toCandidate(ActivityAction.PLANNED, ACTIVITY_WEIGHTS.PLANNED, plans, (fact) => {
        const plan = ACTIVITY_PLAN_FACTS.get(fact.kind);
        const before = this.toPlanAtStart(fact, line);
        return [
          ...(plan ? [plan] : []),
          ...(before !== null && before !== fact.value ? [ActivityDetail.MOVED] : []),
        ];
      }),
      this.toCandidate(ActivityAction.ESTIMATED, ACTIVITY_WEIGHTS.ESTIMATED, estimates, (fact) =>
        weightAtStart !== null && String(weightAtStart) !== fact.value
          ? [ActivityDetail.CHANGED]
          : [],
      ),
    ].filter((candidate) => candidate !== null);
  }

  private toCandidate(
    action: ActivityAction,
    weight: number,
    facts: ActivityFact[],
    toDetails: (fact: ActivityFact) => ActivityDetail[],
  ): ActivityCandidate | null {
    if (!facts.length) {
      return null;
    }
    return {
      action,
      weight,
      time: Math.max(...facts.map((fact) => fact.time)),
      state: null,
      details: [...new Set(facts.flatMap(toDetails))],
      facts,
      parts: [],
    };
  }

  private toPlanAtStart(fact: ActivityFact, line: ActivityLine) {
    if (fact.kind === SourceActionKind.ITERATION_SET) {
      return line.issue?.startOfDay.iteration ?? null;
    }
    if (fact.kind !== SourceActionKind.MILESTONE_SET) {
      return null;
    }
    const item =
      fact.mergeRequestIid === null
        ? line.issue
        : line.mergeRequests.find((mergeRequest) => mergeRequest.iid === fact.mergeRequestIid);
    return item?.startOfDay.milestone ?? null;
  }
}
