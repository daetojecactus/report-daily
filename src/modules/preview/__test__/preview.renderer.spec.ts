import { describe, expect, it } from 'vitest';
import {
  at,
  createIndex,
  createIssue,
  createMergeRequest,
  createService,
  fact,
  ME,
  pushEvent,
  refEvent,
} from 'src/modules/application/report/activity/__test__/activity.fixture';
import {
  SourceActionKind,
  SourceEventAction,
  SourceRefType,
  SourceTargetType,
  WorkItemType,
} from 'src/modules/application/source/types/source.enums';
import type { GroupedDailyData } from 'src/modules/application/source/types/source.interface';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { PreviewRenderer } from '../preview.renderer';

function render(overrides: Partial<GroupedDailyData>, trace = false) {
  const day: GroupedDailyData = {
    projects: [
      { id: 1, name: 'project-1', path: 'group/project-1', webUrl: 'https://gitlab.example.com' },
    ],
    issues: [],
    standaloneMergeRequests: [],
    standalonePushes: [],
    standaloneEvents: [],
    ...overrides,
  };
  const service = createService();
  const results = service.classify(day, { username: ME, role: JobRole.DEVELOPER }, createIndex());
  return new PreviewRenderer().render(day, results, trace, service.summarize(results));
}

const reviewed = createIssue({
  facts: [fact(SourceActionKind.LABEL_ADDED, at(12), { value: 'status::review' })],
  mergeRequests: [
    createMergeRequest({
      facts: [fact(SourceActionKind.APPROVED, at(13))],
      events: [pushEvent(at(11))],
    }),
  ],
});

describe('PreviewRenderer', () => {
  it('prints the main action under every line of the day', () => {
    const lines = render({
      issues: [reviewed],
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

    expect(lines.slice(0, 4)).toEqual([
      '',
      'group/project-1',
      '  Issue #12 Issue 12 · opened',
      '    main: state_set review · with_code',
    ]);
    expect(lines).toContain('  MR !7 Merge request 5 · opened · 12-login');
    expect(lines[lines.indexOf('  MR !7 Merge request 5 · opened · 12-login') + 1]).toBe(
      '    main: merged',
    );
    expect(
      lines.slice(lines.indexOf('  Push 9-spike'), lines.indexOf('  Push 9-spike') + 2),
    ).toEqual(['  Push 9-spike', '    main: code · started']);
  });

  it('prints a push to the branch of an issue under the issue', () => {
    const lines = render({
      issues: [
        createIssue({
          pushes: [
            {
              projectId: 1,
              ref: '12-spike',
              refType: SourceRefType.BRANCH,
              mainBranch: false,
              events: [pushEvent(at(12))],
            },
          ],
        }),
      ],
    });

    expect(lines.slice(2)).toEqual([
      '  Issue #12 Issue 12 · opened',
      '    main: code',
      '    assignees: dev.me',
      '    Push 12-spike',
      '      events: pushed to',
      '      commits: fix: the login',
    ]);
  });

  it('prints a tag and a bulk push with their actions', () => {
    const lines = render({
      standalonePushes: [
        {
          projectId: 1,
          ref: 'v1.4.0',
          refType: SourceRefType.TAG,
          mainBranch: false,
          events: [
            refEvent(at(12), SourceEventAction.PUSHED_NEW, {
              refType: SourceRefType.TAG,
              ref: 'v1.4.0',
            }),
          ],
        },
        {
          projectId: 1,
          ref: null,
          refType: SourceRefType.BRANCH,
          mainBranch: false,
          events: [
            refEvent(at(13), SourceEventAction.DELETED, {
              action: 'removed',
              ref: null,
              refCount: 4,
            }),
          ],
        },
      ],
    });

    expect(lines.slice(2)).toEqual([
      '  Tag v1.4.0',
      '    main: released',
      '    events: pushed new',
      '  Bulk push · 4 branches',
      '    main: deleted · many',
      '    events: deleted',
    ]);
  });

  it('prints the milestone, the iteration and the weight of a task', () => {
    const lines = render({
      issues: [
        createIssue({
          workItemType: WorkItemType.INCIDENT,
          milestone: 'milestone-1',
          iteration: 'iteration-2',
          weight: 3,
          timeSpent: 5400,
          facts: [fact(SourceActionKind.ITERATION_SET, at(10), { value: 'iteration-2' })],
        }),
      ],
    });

    expect(lines.slice(2)).toEqual([
      '  Issue #12 Issue 12 · opened',
      '    main: planned · iteration',
      '    type: incident',
      '    assignees: dev.me',
      '    milestone: milestone-1',
      '    iteration: iteration-2',
      '    weight: 3',
      '    time spent: 1h 30m',
      '    actions: iteration_set iteration-2',
    ]);
  });

  it('prints a wiki page and a milestone with their actions', () => {
    const lines = render({
      standaloneEvents: [
        {
          projectId: 1,
          targetType: SourceTargetType.WIKI_PAGE,
          title: 'page-1',
          events: [{ ...pushEvent(at(10), []), actionName: 'updated', pushData: undefined }],
        },
      ],
    });

    expect(lines.slice(2)).toEqual([
      '  Wiki page page-1',
      '    main: documented',
      '    events: updated',
    ]);
  });

  it('marks the lines of a summary and prints the summaries after the day', () => {
    const planned = (iid: number) =>
      createIssue({
        iid,
        facts: [fact(SourceActionKind.WEIGHT_SET, at(10, iid), { value: '3' })],
      });
    const lines = render({ issues: [planned(1), planned(2), planned(3)] });

    expect(lines.filter((line) => line.includes('main:'))).toEqual([
      '    main: estimated · in a summary',
      '    main: estimated · in a summary',
      '    main: estimated · in a summary',
    ]);
    expect(lines.slice(-2)).toEqual([
      'Summaries',
      '  estimated x3: group/project-1#1, group/project-1#2, group/project-1#3',
    ]);

    const day: GroupedDailyData = {
      projects: [],
      issues: [planned(1), planned(2), planned(3)],
      standaloneMergeRequests: [],
      standalonePushes: [],
      standaloneEvents: [],
    };
    const service = createService();
    const results = service.classify(day, { username: ME, role: JobRole.DEVELOPER }, createIndex());
    const summaries = service.summarize(results);
    expect(
      new PreviewRenderer()
        .render(day, results, false, summaries, {
          lines: new Map(),
          summaries: new Map([[summaries[0], 'Оценил 3 задачи: #1, #2, #3']]),
        })
        .slice(-1),
    ).toEqual(['    text: Оценил 3 задачи: #1, #2, #3']);
  });

  it('marks a task that is kept out of the report', () => {
    const lines = render({
      issues: [
        createIssue({
          labels: ['type::ignore'],
          facts: [fact(SourceActionKind.COMMENTED, at(10))],
        }),
      ],
    });

    expect(lines).toContain('    main: commented · excluded from the report');
  });

  it('prints the phrase of a line under its main action', () => {
    const day: GroupedDailyData = {
      projects: [],
      issues: [reviewed],
      standaloneMergeRequests: [],
      standalonePushes: [],
      standaloneEvents: [],
    };
    const results = createService().classify(
      day,
      { username: ME, role: JobRole.DEVELOPER },
      createIndex(),
    );

    const lines = new PreviewRenderer().render(day, results, false, [], {
      lines: new Map([[results[0], 'Доработал и отправил на ревью «Issue 12»']]),
      summaries: new Map(),
    });

    expect(lines.slice(2, 5)).toEqual([
      '  Issue #12 Issue 12 · opened',
      '    main: state_set review · with_code',
      '    text: Доработал и отправил на ревью «Issue 12»',
    ]);
  });

  it('prints the trace of the choice on request', () => {
    const lines = render({ issues: [reviewed] }, true);
    const main = lines.indexOf('    main: state_set review · with_code');

    expect(lines.slice(main, main + 5)).toEqual([
      '    main: state_set review · with_code',
      '    trace: the only action',
      '      1. state_set review · with_code (transition, 555) ← code',
      '      2. state_only (context, 50)',
      '    dropped: approved (self_approval)',
    ]);
  });
});
