import { describe, expect, it } from 'vitest';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import type { GroupedIssue } from 'src/modules/application/source/types/source-day.interface';
import type { SourceFact } from 'src/modules/application/source/types/source.interface';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { ActivityAction, ActivityDetail } from '../types/activity.enums';
import { at, createIndex, createIssue, createService, fact, ME } from './activity.fixture';

const SPRINT = '2026-08-03 – 2026-08-16';

function summarize(issues: GroupedIssue[]) {
  const service = createService();
  const results = service.classify(
    {
      projects: [],
      issues,
      standaloneMergeRequests: [],
      standalonePushes: [],
      standaloneEvents: [],
    },
    { username: ME, role: JobRole.PROJECT_MANAGER },
    createIndex(),
  );
  return service
    .summarize(results)
    .map(({ action, details, results: lines }) => [
      action,
      details,
      lines.map(({ line }) => line.issue?.iid),
    ]);
}

function issue(iid: number, facts: SourceFact[], overrides: Partial<GroupedIssue> = {}) {
  return createIssue({ iid, facts, ...overrides });
}

const sprint = (minute: number) =>
  fact(SourceActionKind.ITERATION_SET, at(10, minute), { value: SPRINT });

describe('ActivitySummaries', () => {
  it('sums up one planning action over three or more issues', () => {
    expect(
      summarize([issue(1, [sprint(1)]), issue(2, [sprint(2)]), issue(3, [sprint(3)])]),
    ).toEqual([[ActivityAction.PLANNED, [ActivityDetail.ITERATION], [1, 2, 3]]]);
    expect(summarize([issue(1, [sprint(1)]), issue(2, [sprint(2)])])).toEqual([]);
  });

  it('sums up only inside one project', () => {
    expect(
      summarize([
        issue(1, [sprint(1)]),
        issue(2, [sprint(2)]),
        issue(3, [sprint(3)], { projectId: 2 }),
        issue(4, [sprint(4)], { projectId: 2 }),
      ]),
    ).toEqual([]);
    expect(
      summarize([
        issue(1, [sprint(1)]),
        issue(2, [sprint(2)], { projectId: 2 }),
        issue(3, [sprint(3)]),
        issue(4, [sprint(4)]),
      ]),
    ).toEqual([[ActivityAction.PLANNED, [ActivityDetail.ITERATION], [1, 3, 4]]]);
  });

  it('keeps an issue with another own action out of the summary', () => {
    expect(
      summarize([
        issue(1, [sprint(1)]),
        issue(2, [sprint(2)]),
        issue(3, [sprint(3), fact(SourceActionKind.COMMENTED, at(11))]),
      ]),
    ).toEqual([]);
  });

  it('keeps different details and a line left out of the report apart', () => {
    const milestone = (minute: number) =>
      fact(SourceActionKind.MILESTONE_SET, at(10, minute), { value: '17.5' });

    expect(
      summarize([
        issue(1, [sprint(1)]),
        issue(2, [sprint(2)]),
        issue(3, [milestone(3)]),
        issue(4, [sprint(4)], { labels: ['type::ignore'] }),
      ]),
    ).toEqual([]);
  });

  it('sums up estimates and moves too, but never code or comments', () => {
    const weight = (minute: number) =>
      fact(SourceActionKind.WEIGHT_SET, at(10, minute), { value: '3' });
    const comment = (minute: number) => fact(SourceActionKind.COMMENTED, at(10, minute));

    expect(
      summarize([issue(1, [weight(1)]), issue(2, [weight(2)]), issue(3, [weight(3)])]),
    ).toEqual([[ActivityAction.ESTIMATED, [], [1, 2, 3]]]);
    expect(
      summarize([issue(1, [comment(1)]), issue(2, [comment(2)]), issue(3, [comment(3)])]),
    ).toEqual([]);
  });
});
