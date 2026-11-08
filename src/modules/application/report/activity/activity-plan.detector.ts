import { Injectable } from '@nestjs/common';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import { ACTIVITY_PLAN_FACTS, ACTIVITY_WEIGHTS } from './constants/activity.constants';
import { ActivityAction, ActivityDetail } from './activity.enums';
import type {
  ActivityCandidate,
  ActivityFact,
  ActivityLine,
  ActivityLineSignals,
} from './activity.interface';

@Injectable()
export class ActivityPlanDetector {
  detect({ own, line }: ActivityLineSignals): ActivityCandidate[] {
    const facts = own.filter((fact) => ACTIVITY_PLAN_FACTS.has(fact.kind));
    if (!facts.length) {
      return [];
    }
    const details = facts.flatMap((fact) => {
      const plan = ACTIVITY_PLAN_FACTS.get(fact.kind);
      const before = this.toPlanAtStart(fact, line);
      return [
        ...(plan ? [plan] : []),
        ...(before !== null && before !== fact.value ? [ActivityDetail.MOVED] : []),
      ];
    });
    return [
      {
        action: ActivityAction.PLANNED,
        weight: ACTIVITY_WEIGHTS.PLANNED,
        time: Math.max(...facts.map((fact) => fact.time)),
        state: null,
        details: [...new Set(details)],
        facts,
        parts: [],
      },
    ];
  }

  private toPlanAtStart(fact: ActivityFact, line: ActivityLine) {
    if (fact.kind === SourceActionKind.ITERATION_SET) {
      return line.issue?.startOfDay.iteration ?? null;
    }
    const item =
      fact.mergeRequestIid === null
        ? line.issue
        : line.mergeRequests.find((mergeRequest) => mergeRequest.iid === fact.mergeRequestIid);
    return item?.startOfDay.milestone ?? null;
  }
}
