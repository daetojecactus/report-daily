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
} from 'src/modules/application/report/activity/__test__/activity.fixture';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import type { GroupedDailyData } from 'src/modules/application/source/source.interface';
import { JobRole } from 'src/modules/application/user/user.enums';
import { PreviewRenderer } from '../preview.renderer';

function render(overrides: Partial<GroupedDailyData>, trace = false) {
  const day: GroupedDailyData = {
    projects: [
      { id: 1, name: 'project-1', path: 'group/project-1', webUrl: 'https://gitlab.example.com' },
    ],
    issues: [],
    standaloneMergeRequests: [],
    standalonePushes: [],
    ...overrides,
  };
  const results = createService().classify(
    day,
    { username: ME, role: JobRole.DEVELOPER },
    createIndex(),
  );
  return new PreviewRenderer().render(day, results, trace);
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
          branch: '9-spike',
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
            { projectId: 1, branch: '12-spike', mainBranch: false, events: [pushEvent(at(12))] },
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
