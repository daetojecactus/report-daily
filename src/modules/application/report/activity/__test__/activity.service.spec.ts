import { describe, expect, it } from 'vitest';
import { SourceActionKind, SourceRefType } from 'src/modules/application/source/types/source.enums';
import type { GroupedDailyData } from 'src/modules/application/source/types/source-day.interface';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { ActivityAction, ActivityDetail, ActivityRule } from '../types/activity.enums';
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

function classify(overrides: Partial<GroupedDailyData>, index = createIndex()) {
  return createService().classify(
    {
      projects: [],
      issues: [],
      standaloneMergeRequests: [],
      standalonePushes: [],
      standaloneEvents: [],
      ...overrides,
    },
    { username: ME, role: JobRole.DEVELOPER },
    index,
  );
}

describe('ActivityService', () => {
  it('drops the changes of ignored names and leaves a line with nothing else out', () => {
    const changes = [
      fact(SourceActionKind.LABEL_ADDED, at(10), { value: 'Team::Infra' }),
      fact(SourceActionKind.LABEL_REMOVED, at(10, 1), { value: 'Team::Infra' }),
      fact(SourceActionKind.STATUS_SET, at(10, 5), { value: 'Waiting' }),
    ];
    const index = createIndex(['team::infra', 'waiting']);

    const [ignored] = classify({ issues: [createIssue({ facts: changes })] }, index);
    expect(ignored.excluded).toBe(true);
    expect(ignored.choice.main.action).toBe(ActivityAction.STATE_ONLY);
    expect(ignored.signals.dropped.map(({ rule }) => rule)).toEqual([
      ActivityRule.IGNORED_NAME,
      ActivityRule.IGNORED_NAME,
      ActivityRule.IGNORED_NAME,
    ]);

    const [counted] = classify({ issues: [createIssue({ facts: changes })] });
    expect(counted.excluded).toBe(false);
    expect(counted.choice.main.action).toBe(ActivityAction.EDITED);

    const [commented] = classify(
      { issues: [createIssue({ facts: [fact(SourceActionKind.COMMENTED, at(9)), ...changes] })] },
      index,
    );
    expect(commented.excluded).toBe(false);
    expect(commented.choice.main.action).toBe(ActivityAction.COMMENTED);
  });

  it('classifies every line of the day', () => {
    const results = classify({
      issues: [createIssue({ facts: [fact(SourceActionKind.COMMENTED, at(10))] })],
      standaloneMergeRequests: [
        createMergeRequest({ iid: 7, facts: [fact(SourceActionKind.MERGED, at(15))] }),
      ],
      standalonePushes: [
        {
          projectId: 1,
          ref: '9-spike',
          refType: SourceRefType.BRANCH,
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
    expect(results.map(({ line }) => line.pushes.map((push) => push.ref))).toEqual([
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
              ref: '12-spike',
              refType: SourceRefType.BRANCH,
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

  it('leaves out a task the employee did nothing with that day', () => {
    const results = classify({
      issues: [
        createIssue({ labels: ['status::todo'] }),
        createIssue({
          iid: 13,
          labels: ['status::todo'],
          events: [
            {
              id: 2,
              projectId: 1,
              actionName: 'commented on',
              targetType: 'Note',
              targetTitle: null,
              createdAt: at(10),
            },
          ],
        }),
      ],
    });

    expect(results.map(({ choice }) => choice.main.action)).toEqual([
      ActivityAction.STATE_ONLY,
      ActivityAction.STATE_ONLY,
    ]);
    expect(results.map(({ excluded }) => excluded)).toEqual([true, false]);
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
