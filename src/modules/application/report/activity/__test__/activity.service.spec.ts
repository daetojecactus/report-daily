import { describe, expect, it } from 'vitest';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import type { GroupedDailyData } from 'src/modules/application/source/source.interface';
import { JobRole } from 'src/modules/application/user/user.enums';
import { ActivityAction, ActivityDetail } from '../activity.enums';
import {
  at,
  createIndex,
  createIssue,
  createMergeRequest,
  createService,
  fact,
  ME,
  pushEvent,
} from './activity.fixture';

function classify(overrides: Partial<GroupedDailyData>) {
  return createService().classify(
    { projects: [], issues: [], standaloneMergeRequests: [], standalonePushes: [], ...overrides },
    { username: ME, role: JobRole.DEVELOPER },
    createIndex(),
  );
}

describe('ActivityService', () => {
  it('classifies every line of the day', () => {
    const results = classify({
      issues: [createIssue({ facts: [fact(SourceActionKind.COMMENTED, at(10))] })],
      standaloneMergeRequests: [
        createMergeRequest({ iid: 7, facts: [fact(SourceActionKind.MERGED, at(15))] }),
      ],
      standalonePushes: [
        {
          projectId: 1,
          branch: '9-spike',
          mainBranch: false,
          events: [{ ...pushEvent(at(12), []), actionName: 'pushed new' }],
        },
      ],
    });

    expect(results.map(({ choice }) => [choice.main.action, choice.main.details])).toEqual([
      [ActivityAction.COMMENTED, []],
      [ActivityAction.MERGED, []],
      [ActivityAction.CODE, [ActivityDetail.STARTED]],
    ]);
    expect(results.map(({ line }) => line.pushes.map((push) => push.branch))).toEqual([
      [],
      [],
      ['9-spike'],
    ]);
  });

  it('counts a push to the branch of an issue as work on the line of the issue', () => {
    const [result] = classify({
      issues: [
        createIssue({
          pushes: [
            {
              projectId: 1,
              branch: '12-spike',
              mainBranch: false,
              events: [{ ...pushEvent(at(12), []), actionName: 'pushed new' }],
            },
          ],
        }),
      ],
    });

    expect(result.choice.main).toMatchObject({
      action: ActivityAction.CODE,
      details: [ActivityDetail.STARTED],
    });
  });

  it('marks a task that the company keeps out of the report', () => {
    const results = classify({
      issues: [
        createIssue({
          labels: ['type::ignore'],
          facts: [fact(SourceActionKind.COMMENTED, at(10))],
        }),
        createIssue({ iid: 13, facts: [fact(SourceActionKind.COMMENTED, at(11))] }),
      ],
    });

    expect(results.map(({ excluded }) => excluded)).toEqual([true, false]);
    expect(results[0].choice.main.action).toBe(ActivityAction.COMMENTED);
  });
});
