import { Injectable } from '@nestjs/common';
import { WorkflowState } from 'src/modules/application/trait/types/trait.enums';
import { ACTIVITY_CHAIN_BONUS, ACTIVITY_CODE_CHANGE_FACTS } from './constants/activity.constants';
import { ActivityAction, ActivityDetail } from './types/activity.enums';
import type {
  ActivityCandidate,
  ActivityChain,
  ActivityFact,
  ActivityLineSignals,
} from './types/activity.interface';

@Injectable()
export class ActivityChains {
  combine(signals: ActivityLineSignals, candidates: ActivityCandidate[]): ActivityCandidate[] {
    const isState = (candidate: ActivityCandidate, states: WorkflowState[]) =>
      candidate.action === ActivityAction.STATE_SET &&
      candidate.state !== null &&
      states.includes(candidate.state);
    const isTesting = (candidate: ActivityCandidate) =>
      candidate.action === ActivityAction.TOOK_REVIEW ||
      isState(candidate, [WorkflowState.TESTING]);
    const chains: ActivityChain[] = [
      {
        isHead: (candidate) =>
          candidate.action === ActivityAction.MERGED ||
          candidate.action === ActivityAction.MERGED_OTHER,
        isPart: (candidate, head) =>
          candidate.action === ActivityAction.MERGE_SCHEDULED &&
          candidate.time <= head.time &&
          this.sharesMergeRequest(candidate, head),
        details: () => [ActivityDetail.AUTO_MERGE],
      },
      {
        isHead: (candidate) => candidate.action === ActivityAction.MERGED_OTHER,
        isPart: (candidate, head) =>
          candidate.action === ActivityAction.APPROVED && this.sharesMergeRequest(candidate, head),
        details: () => [ActivityDetail.WITH_APPROVAL],
      },
      {
        isHead: (candidate) => isState(candidate, [WorkflowState.QA_PASSED]),
        isPart: (candidate) => candidate.action === ActivityAction.APPROVED,
        details: () => [ActivityDetail.WITH_APPROVAL],
      },
      {
        isHead: (candidate) => isState(candidate, [WorkflowState.QA_PASSED]),
        isPart: (candidate, head) => isTesting(candidate) && candidate.time <= head.time,
        details: () => [ActivityDetail.WITH_TESTING],
      },
      {
        isHead: (candidate) => candidate.action === ActivityAction.RETURNED,
        isPart: (candidate) => candidate.action === ActivityAction.REVIEWED,
        details: () => [ActivityDetail.WITH_REMARKS],
      },
      {
        isHead: (candidate) => candidate.action === ActivityAction.RETURNED,
        isPart: (candidate, head) => isTesting(candidate) && candidate.time <= head.time,
        details: () => [ActivityDetail.WITH_TESTING],
      },
      {
        isHead: (candidate) =>
          isState(candidate, [WorkflowState.REVIEW, WorkflowState.READY_FOR_QA]),
        isPart: (candidate, head) =>
          candidate.action === ActivityAction.CODE &&
          this.toChangedAt(signals, candidate.facts) <= head.time,
        details: (parts) => [ActivityDetail.WITH_CODE, ...parts.flatMap((part) => part.details)],
      },
      {
        isHead: (candidate) => candidate.action === ActivityAction.PLANNED,
        isPart: (candidate) => isState(candidate, [WorkflowState.PLANNED]),
        details: () => [],
      },
      {
        isHead: (candidate) => candidate.action === ActivityAction.REQUIREMENTS,
        isPart: (candidate, head) =>
          (isState(candidate, [WorkflowState.PLANNED, WorkflowState.IN_PROGRESS]) ||
            candidate.action === ActivityAction.PLANNED) &&
          candidate.time >= Math.min(...head.facts.map((fact) => fact.time)),
        details: () => [ActivityDetail.WITH_STATE],
        state: (parts) => {
          const last = parts.at(-1);
          return last?.action === ActivityAction.PLANNED
            ? WorkflowState.PLANNED
            : (last?.state ?? null);
        },
      },
    ];
    return chains.reduce(
      (result, chain) => this.absorb(result, chain),
      this.mergeRepeats(candidates),
    );
  }

  private mergeRepeats(candidates: ActivityCandidate[]) {
    const merged = new Map<string, ActivityCandidate>();
    for (const candidate of candidates) {
      const key = [
        candidate.action,
        candidate.state ?? '',
        ...(candidate.action === ActivityAction.STATE_SET ? [] : candidate.details),
      ].join('|');
      const same = merged.get(key);
      merged.set(
        key,
        same
          ? {
              ...same,
              time: Math.max(same.time, candidate.time),
              details: [...new Set([...same.details, ...candidate.details])],
              facts: this.toFacts([same, candidate]),
            }
          : candidate,
      );
    }
    return [...merged.values()];
  }

  private absorb(candidates: ActivityCandidate[], chain: ActivityChain) {
    const head = candidates
      .filter((candidate) => chain.isHead(candidate))
      .toSorted((left, right) => right.time - left.time)
      .at(0);
    const parts = head
      ? candidates.filter((candidate) => candidate !== head && chain.isPart(candidate, head))
      : [];
    if (!head || !parts.length) {
      return candidates;
    }
    const composite: ActivityCandidate = {
      ...head,
      weight: head.parts.length ? head.weight : head.weight + ACTIVITY_CHAIN_BONUS,
      time: Math.max(head.time, ...parts.map((part) => part.time)),
      state: chain.state?.(parts) ?? head.state,
      details: [...new Set([...head.details, ...chain.details(parts)])],
      facts: this.toFacts([head, ...parts]),
      parts: [...head.parts, ...parts],
    };
    return candidates
      .filter((candidate) => !parts.includes(candidate))
      .map((candidate) => (candidate === head ? composite : candidate));
  }

  private toFacts(candidates: ActivityCandidate[]) {
    return candidates
      .flatMap((candidate) => candidate.facts)
      .sort((left, right) => left.time - right.time);
  }

  private toChangedAt(signals: ActivityLineSignals, facts: ActivityFact[]) {
    return Math.min(
      ...signals.pushes.map((push) => push.time),
      ...facts.filter((fact) => ACTIVITY_CODE_CHANGE_FACTS.has(fact.kind)).map((fact) => fact.time),
    );
  }

  private sharesMergeRequest(left: ActivityCandidate, right: ActivityCandidate) {
    return left.facts.some(
      (fact) =>
        fact.mergeRequestIid !== null &&
        right.facts.some((other) => other.mergeRequestIid === fact.mergeRequestIid),
    );
  }
}
