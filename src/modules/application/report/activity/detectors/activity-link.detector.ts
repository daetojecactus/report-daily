import { Injectable } from '@nestjs/common';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import { ACTIVITY_LINK_DETAILS } from '../constants/activity-facts.constants';
import { ACTIVITY_WEIGHTS } from '../constants/activity-weights.constants';
import { ActivityAction, ActivityDetail } from '../types/activity.enums';
import type {
  ActivityCandidate,
  ActivityFact,
  ActivityLineSignals,
} from '../types/activity.interface';

@Injectable()
export class ActivityLinkDetector {
  detect({ own }: ActivityLineSignals): ActivityCandidate[] {
    const of = (kind: SourceActionKind) => own.filter((fact) => fact.kind === kind);
    const closed = own.some(
      (fact) => fact.kind === SourceActionKind.CLOSED && fact.mergeRequestIid === null,
    );
    const links = [
      ...of(SourceActionKind.LINKED),
      ...(closed ? [] : of(SourceActionKind.DUPLICATE_MARKED)),
    ];
    return [
      this.toCandidate(ActivityAction.LINKED, ACTIVITY_WEIGHTS.LINKED, links, (fact) =>
        fact.kind === SourceActionKind.DUPLICATE_MARKED
          ? ActivityDetail.DUPLICATE
          : ACTIVITY_LINK_DETAILS.get(fact.value ?? ''),
      ),
      this.toCandidate(
        ActivityAction.DECOMPOSED,
        ACTIVITY_WEIGHTS.DECOMPOSED,
        of(SourceActionKind.CHILD_ADDED),
        () => undefined,
      ),
      this.toCandidate(
        ActivityAction.MOVED,
        ACTIVITY_WEIGHTS.MOVED,
        of(SourceActionKind.MOVED_IN),
        () => undefined,
      ),
    ].filter((candidate) => candidate !== null);
  }

  private toCandidate(
    action: ActivityAction,
    weight: number,
    facts: ActivityFact[],
    toDetail: (fact: ActivityFact) => ActivityDetail | undefined,
  ): ActivityCandidate | null {
    if (!facts.length) {
      return null;
    }
    return {
      action,
      weight,
      time: Math.max(...facts.map((fact) => fact.time)),
      state: null,
      details: [...new Set(facts.map(toDetail).filter((detail) => detail !== undefined))],
      facts,
      parts: [],
    };
  }
}
