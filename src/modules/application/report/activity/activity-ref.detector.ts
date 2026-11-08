import { Injectable } from '@nestjs/common';
import { SourceActionKind, SourceRefType } from 'src/modules/application/source/source.enums';
import type { CleanEvent } from 'src/modules/application/source/source.interface';
import {
  ACTIVITY_DELETE_ACTION,
  ACTIVITY_PUSH_ACTIONS,
  ACTIVITY_VERSION_TAG_PATTERN,
  ACTIVITY_WEIGHTS,
} from './constants/activity.constants';
import { ActivityAction, ActivityDetail } from './activity.enums';
import type { ActivityCandidate, ActivityLineSignals } from './activity.interface';

@Injectable()
export class ActivityRefDetector {
  detect({ line, own }: ActivityLineSignals): ActivityCandidate[] {
    const merged = new Set(
      own
        .filter((fact) => fact.kind === SourceActionKind.MERGED)
        .map((fact) => fact.mergeRequestIid),
    );
    const events = [
      ...line.mergeRequests
        .filter((mergeRequest) => !merged.has(mergeRequest.iid))
        .flatMap((mergeRequest) => mergeRequest.events),
      ...line.pushes.flatMap((push) => push.events),
    ].filter((event) => event.pushData);
    const tags = events.filter(
      (event) =>
        event.pushData?.refType === SourceRefType.TAG &&
        ACTIVITY_PUSH_ACTIONS.has(event.actionName),
    );
    const versions = tags.filter((event) =>
      ACTIVITY_VERSION_TAG_PATTERN.test(event.pushData?.ref ?? ''),
    );
    return [
      this.toCandidate(ActivityAction.RELEASED, ACTIVITY_WEIGHTS.RELEASED, versions),
      this.toCandidate(
        ActivityAction.TAGGED,
        ACTIVITY_WEIGHTS.TAGGED,
        tags.filter((event) => !versions.includes(event)),
      ),
      this.toCandidate(
        ActivityAction.DELETED,
        ACTIVITY_WEIGHTS.DELETED,
        events.filter((event) => event.actionName === ACTIVITY_DELETE_ACTION),
      ),
    ].filter((candidate) => candidate !== null);
  }

  private toCandidate(
    action: ActivityAction,
    weight: number,
    events: CleanEvent[],
  ): ActivityCandidate | null {
    if (!events.length) {
      return null;
    }
    const has = (check: (event: CleanEvent) => boolean) => events.some(check);
    return {
      action,
      weight,
      time: Math.max(...events.map((event) => Date.parse(event.createdAt))),
      state: null,
      details: [
        ...(has((event) => event.pushData?.ref === null) ? [ActivityDetail.MANY] : []),
        ...(action === ActivityAction.DELETED &&
        has((event) => event.pushData?.refType === SourceRefType.TAG)
          ? [ActivityDetail.TAG]
          : []),
      ],
      facts: [],
      parts: [],
    };
  }
}
