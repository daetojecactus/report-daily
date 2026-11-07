import { describe, expect, it } from 'vitest';
import { WorkflowState } from 'src/modules/application/trait/trait.enums';
import { ActivityAction } from '../activity.enums';
import type { ActivityCandidate, ActivityResult } from '../activity.interface';
import { createService } from './activity.fixture';
import type { GoldenVerdict } from './activity.golden.fixture';
import { createGoldenIndex, loadGoldenDays } from './activity.golden.fixture';

type Reason = 'closed_by_others' | 'new_signal' | 'merge_request_labels' | 'composite';

const ACCEPTED: Record<string, [ActivityAction, WorkflowState?][]> = {
  FIXED_BUG: [[ActivityAction.MERGED]],
  IMPLEMENTED_FEATURE: [[ActivityAction.MERGED]],
  HOTFIX_DEPLOYED: [[ActivityAction.MERGED]],
  COMPLETED_BY_MERGE: [[ActivityAction.MERGED], [ActivityAction.COMPLETED]],
  MERGED_OTHERS_WORK: [[ActivityAction.MERGED_OTHER]],
  APPROVED_MR: [[ActivityAction.APPROVED]],
  TESTED_AND_APPROVED: [
    [ActivityAction.APPROVED],
    [ActivityAction.STATE_SET, WorkflowState.QA_PASSED],
  ],
  TESTED_WITH_COMMENTS: [[ActivityAction.REVIEWED], [ActivityAction.RETURNED]],
  REVIEW_COMMENT: [[ActivityAction.REVIEWED]],
  COMMENTED: [[ActivityAction.COMMENTED], [ActivityAction.DISCUSSED], [ActivityAction.REVIEWED]],
  PUT_ON_HOLD: [[ActivityAction.STATE_SET, WorkflowState.BLOCKED]],
  TASK_SENT_TO_QA: [[ActivityAction.STATE_SET, WorkflowState.READY_FOR_QA]],
  CLOSED_WITHOUT_MERGE: [[ActivityAction.CLOSED]],
  VERIFIED_FIX: [[ActivityAction.CLOSED]],
  ACCEPTED_WORK: [[ActivityAction.CLOSED]],
  REVIEWED_AND_CLOSED: [[ActivityAction.CLOSED]],
  STARTED: [[ActivityAction.CODE]],
  STARTED_IMPLEMENTATION: [[ActivityAction.CODE]],
  WROTE_CODE: [[ActivityAction.CODE]],
  REFACTORED_CODE: [[ActivityAction.CODE]],
  QA_AUTOMATION_DEVELOPED: [[ActivityAction.CODE], [ActivityAction.MERGED]],
  QA_AWAITING_TESTING: [[ActivityAction.STATE_ONLY], [ActivityAction.TOOK_REVIEW]],
  QA_IN_PROGRESS: [[ActivityAction.TOOK_REVIEW], [ActivityAction.STATE_SET, WorkflowState.TESTING]],
  FOUND_BUG: [[ActivityAction.BUG_FOUND]],
  REPORTED_BUG: [[ActivityAction.BUG_FOUND]],
  CREATED: [[ActivityAction.CREATED]],
  PLANNED_FEATURE: [[ActivityAction.CREATED]],
  DELEGATED_TASK: [
    [ActivityAction.COMMENTED],
    [ActivityAction.ASSIGNED],
    [ActivityAction.REQUIREMENTS, WorkflowState.IN_PROGRESS],
  ],
  UNKNOWN: [[ActivityAction.STATE_ONLY]],
  PROVIDED_REQUIREMENTS: [[ActivityAction.REQUIREMENTS], [ActivityAction.COMMENTED]],
  PLANNED_FOR_SPRINT: [
    [ActivityAction.STATE_SET, WorkflowState.PLANNED],
    [ActivityAction.REQUIREMENTS, WorkflowState.PLANNED],
  ],
};

const PUSHES_IN_ISSUES = ['developer-user-21-2026-11-03 push:9:123-branch-25'];

const DIVERGENCES: Record<string, Reason> = {
  'qa-user-1-2026-10-29 1#772': 'composite',
  'qa-user-1-2026-10-29 5#1061': 'closed_by_others',
  'qa-user-1-2026-10-30 1#748': 'merge_request_labels',
  'qa-user-1-2026-11-02 15!626': 'merge_request_labels',
  'qa-user-1-2026-11-03 1#759': 'merge_request_labels',
  'qa-user-1-2026-11-03 1#777': 'closed_by_others',
  'qa-user-1-2026-11-03 13#84': 'closed_by_others',
  'qa-user-1-2026-11-03 17#251': 'closed_by_others',
  'qa-user-1-2026-11-03 18#233': 'closed_by_others',
  'qa-user-1-2026-11-04 1#759': 'merge_request_labels',
  'qa-user-1-2026-11-04 3#1611': 'closed_by_others',
  'qa-user-1-2026-11-04 5#1064': 'closed_by_others',
  'qa-user-1-2026-11-05 13#91': 'closed_by_others',
  'qa-user-1-2026-11-05 5#1066': 'closed_by_others',
  'system_analyst-user-13-2026-10-29 8#686': 'new_signal',
  'system_analyst-user-13-2026-10-30 6#2659': 'new_signal',
  'system_analyst-user-13-2026-11-02 6#2662': 'closed_by_others',
  'system_analyst-user-13-2026-11-02 9#66': 'new_signal',
  'system_analyst-user-13-2026-11-02 11#609': 'new_signal',
  'system_analyst-user-13-2026-11-03 6#2645': 'closed_by_others',
  'system_analyst-user-13-2026-11-04 10#178': 'closed_by_others',
  'system_analyst-user-13-2026-11-04 9#66': 'new_signal',
  'system_analyst-user-13-2026-11-04 11#609': 'new_signal',
  'system_analyst-user-13-2026-11-05 6#2660': 'closed_by_others',
};

function toKey({ line }: ActivityResult) {
  const item = line.issue ?? line.mergeRequests.at(0);
  if (!item) {
    return `push:${line.pushes[0].projectId}:${line.pushes[0].branch}`;
  }
  return `${item.projectId}${line.issue ? '#' : '!'}${item.iid}`;
}

function isAccepted(status: string, main: ActivityCandidate) {
  return (ACCEPTED[status] ?? []).some(
    ([action, state]) => main.action === action && (state === undefined || main.state === state),
  );
}

describe('the action engine on the golden days', () => {
  const index = createGoldenIndex();
  const service = createService();
  const unused: string[] = [];
  const lines = loadGoldenDays().flatMap((golden) => {
    const verdicts = new Map<string, GoldenVerdict>([
      ...golden.verdicts.issues.map((verdict): [string, GoldenVerdict] => [
        `${verdict.projectId}#${verdict.iid}`,
        verdict,
      ]),
      ...golden.verdicts.standaloneMergeRequests.map((verdict): [string, GoldenVerdict] => [
        `${verdict.projectId}!${verdict.iid}`,
        verdict,
      ]),
      ...golden.verdicts.standalonePushes.map((verdict): [string, GoldenVerdict] => [
        `push:${verdict.projectId}:${verdict.branch}`,
        verdict,
      ]),
    ]);
    const results = service.classify(
      golden.day,
      { username: golden.username, role: golden.role },
      index,
    );
    const keys = new Set(results.map(toKey));
    unused.push(
      ...[...verdicts.keys()].filter((key) => !keys.has(key)).map((key) => `${golden.name} ${key}`),
    );
    return results.map((result) => ({
      key: `${golden.name} ${toKey(result)}`,
      status: verdicts.get(toKey(result))?.status ?? null,
      result,
    }));
  });

  it('gives every golden line its V1 verdict', () => {
    expect(lines).toHaveLength(102);
    expect(lines.filter((line) => line.status === null).map((line) => line.key)).toEqual([]);
  });

  it('leaves out only the V1 lines of pushes that are now part of their issue', () => {
    expect(unused).toEqual(PUSHES_IN_ISSUES);
  });

  it('matches V1 on every line except the documented divergences', () => {
    const diverged = lines.filter(
      (line) => line.status !== null && !isAccepted(line.status, line.result.choice.main),
    );
    const listed = new Set(Object.keys(DIVERGENCES));

    expect(diverged.filter((line) => !listed.has(line.key)).map((line) => line.key)).toEqual([]);
    expect([...listed].filter((key) => !diverged.some((line) => line.key === key))).toEqual([]);
    expect(lines.length - diverged.length).toBe(78);
    expect(
      Object.values(DIVERGENCES).reduce<Record<string, number>>(
        (total, reason) => ({ ...total, [reason]: (total[reason] ?? 0) + 1 }),
        {},
      ),
    ).toEqual({ closed_by_others: 13, new_signal: 6, merge_request_labels: 4, composite: 1 });
  });

  it('leaves no own fact of a real day without an action', () => {
    const lost = lines.flatMap(({ key, result }) => {
      const covered = new Set([
        ...result.choice.main.facts,
        ...result.choice.secondary.flatMap((candidate) => candidate.facts),
      ]);
      return result.signals.own.filter((fact) => !covered.has(fact)).map(() => key);
    });

    expect(lost).toEqual([]);
  });
});
