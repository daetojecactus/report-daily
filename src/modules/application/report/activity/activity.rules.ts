import { Injectable } from '@nestjs/common';
import { SOURCE_NAME_FACTS } from 'src/modules/application/source/constants/source.constants';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import {
  ACTIVITY_AUTO_STATUS_MS,
  ACTIVITY_EDIT_FACTS,
  ACTIVITY_LIFECYCLE_FACTS,
  ACTIVITY_MERGE_CLOSE_MS,
  ACTIVITY_MOVE_MS,
  ACTIVITY_OPPOSITE_FACTS,
  ACTIVITY_SETUP_FACTS,
  ACTIVITY_SETUP_MS,
  ACTIVITY_SWAP_FACTS,
  ACTIVITY_SWAP_MS,
  ACTIVITY_UNDO_MS,
} from './constants/activity.constants';
import { ActivityRule } from './activity.enums';
import type { ActivityDropped, ActivityEmployee, ActivityFact } from './activity.interface';

@Injectable()
export class ActivityRules {
  clean(
    facts: ActivityFact[],
    employee: ActivityEmployee,
    ownMergeRequests: number[],
    isIgnored: (name: string) => boolean,
  ) {
    const ignored = facts.filter(
      (fact) => SOURCE_NAME_FACTS.has(fact.kind) && fact.value !== null && isIgnored(fact.value),
    );
    const skipped = new Set(ignored);
    const counted = facts.filter((fact) => !skipped.has(fact));
    const undone = this.findUndone(counted);
    const active = counted.filter((fact) => !undone.has(fact));
    const creations = facts.filter((fact) => fact.kind === SourceActionKind.OPENED);
    const merges = facts.filter((fact) => fact.kind === SourceActionKind.MERGED);
    const arrivals = facts.filter((fact) => fact.kind === SourceActionKind.MOVED_IN);
    const departures = facts.filter((fact) => fact.kind === SourceActionKind.MOVED_OUT);
    const rules: [ActivityRule, (fact: ActivityFact) => boolean][] = [
      [ActivityRule.MOVED_AWAY, (fact) => this.isMovedAway(fact, departures)],
      [ActivityRule.RECIPROCAL_LINK, (fact) => fact.kind === SourceActionKind.RECIPROCAL_LINK],
      [
        ActivityRule.SETUP,
        (fact) => this.isSetup(fact, creations) || this.isArrivalSetup(fact, arrivals),
      ],
      [ActivityRule.AUTOMATIC_STATUS, (fact) => this.isAutomaticStatus(fact, facts)],
      [ActivityRule.CLOSED_BY_MERGE, (fact) => this.isClosedByMerge(fact, merges)],
      [ActivityRule.SELF_APPROVAL, (fact) => this.isSelfApproval(fact, ownMergeRequests)],
      [ActivityRule.SELF_REVIEW_REMOVAL, (fact) => this.isSelfReviewRemoval(fact, employee)],
      [ActivityRule.REPLACED, (fact) => this.isReplaced(fact, active)],
    ];
    const own: ActivityFact[] = [];
    const dropped: ActivityDropped[] = [
      ...ignored.map((fact) => ({ fact, rule: ActivityRule.IGNORED_NAME })),
      ...[...undone].map((fact) => ({ fact, rule: ActivityRule.UNDONE })),
    ];
    for (const fact of active) {
      const rule =
        rules.find(([, applies]) => applies(fact))?.[0] ??
        (this.isRepeated(fact, own) ? ActivityRule.REPEATED : null);
      if (rule) {
        dropped.push({ fact, rule });
      } else {
        own.push(fact);
      }
    }
    return { own, dropped: dropped.sort((left, right) => left.fact.time - right.fact.time) };
  }

  private findUndone(facts: ActivityFact[]) {
    const undone = new Set<ActivityFact>();
    for (const [index, fact] of facts.entries()) {
      const opposite = ACTIVITY_OPPOSITE_FACTS.get(fact.kind);
      if (!opposite || undone.has(fact)) {
        continue;
      }
      const reverse = facts
        .slice(index + 1)
        .find(
          (other) =>
            !undone.has(other) &&
            other.kind === opposite &&
            other.mergeRequestIid === fact.mergeRequestIid &&
            this.toUndoKey(other) === this.toUndoKey(fact) &&
            other.time - fact.time <= ACTIVITY_UNDO_MS,
        );
      if (reverse) {
        undone.add(fact);
        undone.add(reverse);
      }
    }
    return undone;
  }

  private toUndoKey(fact: ActivityFact) {
    return [fact.value ?? '', ...fact.users.toSorted()].join('|');
  }

  private isSetup(fact: ActivityFact, creations: ActivityFact[]) {
    return creations.some(
      (creation) =>
        creation.mergeRequestIid === fact.mergeRequestIid &&
        fact.time >= creation.time &&
        ((ACTIVITY_SETUP_FACTS.has(fact.kind) && fact.time - creation.time <= ACTIVITY_SETUP_MS) ||
          ACTIVITY_EDIT_FACTS.has(fact.kind)),
    );
  }

  private isMovedAway(fact: ActivityFact, departures: ActivityFact[]) {
    return departures.some(
      (departure) =>
        departure.mergeRequestIid === fact.mergeRequestIid &&
        Math.abs(fact.time - departure.time) <= ACTIVITY_MOVE_MS,
    );
  }

  private isArrivalSetup(fact: ActivityFact, arrivals: ActivityFact[]) {
    return arrivals.some(
      (arrival) =>
        fact !== arrival &&
        arrival.mergeRequestIid === fact.mergeRequestIid &&
        (fact.time < arrival.time ||
          (fact.time - arrival.time <= ACTIVITY_SETUP_MS &&
            (ACTIVITY_SETUP_FACTS.has(fact.kind) || ACTIVITY_EDIT_FACTS.has(fact.kind)))),
    );
  }

  private isAutomaticStatus(fact: ActivityFact, facts: ActivityFact[]) {
    return (
      fact.kind === SourceActionKind.STATUS_SET &&
      facts.some(
        (other) =>
          ACTIVITY_LIFECYCLE_FACTS.has(other.kind) &&
          other.mergeRequestIid === fact.mergeRequestIid &&
          Math.abs(other.time - fact.time) <= ACTIVITY_AUTO_STATUS_MS,
      )
    );
  }

  private isClosedByMerge(fact: ActivityFact, merges: ActivityFact[]) {
    return (
      fact.kind === SourceActionKind.CLOSED &&
      fact.mergeRequestIid === null &&
      merges.some(
        (merge) => fact.time >= merge.time && fact.time - merge.time <= ACTIVITY_MERGE_CLOSE_MS,
      )
    );
  }

  private isSelfApproval(fact: ActivityFact, ownMergeRequests: number[]) {
    return (
      fact.kind === SourceActionKind.APPROVED &&
      fact.mergeRequestIid !== null &&
      ownMergeRequests.includes(fact.mergeRequestIid)
    );
  }

  private isSelfReviewRemoval(fact: ActivityFact, employee: ActivityEmployee) {
    return (
      fact.kind === SourceActionKind.REVIEW_REQUEST_REMOVED &&
      fact.users.length === 1 &&
      fact.users[0] === employee.username
    );
  }

  private isReplaced(fact: ActivityFact, facts: ActivityFact[]) {
    const addition = ACTIVITY_SWAP_FACTS.get(fact.kind);
    return facts.some(
      (other) =>
        other.kind === addition &&
        other.mergeRequestIid === fact.mergeRequestIid &&
        Math.abs(other.time - fact.time) <= ACTIVITY_SWAP_MS,
    );
  }

  private isRepeated(fact: ActivityFact, before: ActivityFact[]) {
    return (
      ACTIVITY_SETUP_FACTS.has(fact.kind) &&
      before.some(
        (other) =>
          other.kind === fact.kind &&
          other.value === fact.value &&
          other.mergeRequestIid !== fact.mergeRequestIid &&
          fact.time - other.time <= ACTIVITY_UNDO_MS,
      )
    );
  }
}
