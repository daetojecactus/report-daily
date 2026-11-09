import { describe, expect, it } from 'vitest';
import { classifyGoldenDays, GOLDEN_DIVERGENCES, isAcceptedByV1 } from './activity.golden.fixture';

const PUSHES_IN_ISSUES = ['developer-user-21-2026-11-03 push:9:123-branch-25'];

describe('the action engine on the golden days', () => {
  const { lines, unused } = classifyGoldenDays();

  it('gives every golden line its V1 verdict', () => {
    expect(lines).toHaveLength(102);
    expect(lines.filter((line) => line.status === null).map((line) => line.key)).toEqual([]);
  });

  it('leaves out only the V1 lines of pushes that are now part of their issue', () => {
    expect(unused).toEqual(PUSHES_IN_ISSUES);
  });

  it('matches V1 on every line except the documented divergences', () => {
    const diverged = lines.filter(
      (line) => line.status !== null && !isAcceptedByV1(line.status, line.result.choice.main),
    );
    const listed = new Set(Object.keys(GOLDEN_DIVERGENCES));

    expect(diverged.filter((line) => !listed.has(line.key)).map((line) => line.key)).toEqual([]);
    expect([...listed].filter((key) => !diverged.some((line) => line.key === key))).toEqual([]);
    expect(lines.length - diverged.length).toBe(78);
    expect(
      Object.values(GOLDEN_DIVERGENCES).reduce<Record<string, number>>(
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
