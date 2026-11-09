import { describe, expect, it } from 'vitest';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import { JobRole } from 'src/modules/application/user/user.enums';
import { ActivityAction, ActivityTier } from '../../activity/activity.enums';
import {
  at,
  createIssue,
  createMergeRequest,
  fact,
  ME,
} from '../../activity/__test__/activity.fixture';
import { TemplateItemType } from '../template.enums';
import { buildContext, createDay, GITLAB_URL } from './template.fixture';

const SPRINT = '2026-11-05 – 2026-11-18';

function mergedBug(iid: number) {
  return createIssue({
    iid,
    title: `Issue ${iid}`,
    labels: ['type::bug'],
    mergeRequests: [
      createMergeRequest({
        iid: iid + 100,
        mergedOnReportDate: true,
        facts: [fact(SourceActionKind.MERGED, at(15))],
      }),
    ],
  });
}

function commented(iid: number, overrides: Parameters<typeof createIssue>[0] = {}) {
  return createIssue({
    iid,
    title: `Issue ${iid}`,
    facts: [fact(SourceActionKind.COMMENTED, at(10))],
    ...overrides,
  });
}

function planned(iid: number, projectId = 1) {
  return createIssue({
    iid,
    projectId,
    title: `Issue ${iid}`,
    facts: [fact(SourceActionKind.ITERATION_SET, at(10, iid), { value: SPRINT })],
  });
}

describe('TemplateContext', () => {
  it('describes the day, the employee and the language', () => {
    const context = buildContext(createDay({ issues: [commented(1)] }));

    expect(context).toMatchObject({
      version: 1,
      date: '2026-11-09',
      dateText: '9 ноября',
      weekday: 'понедельник',
      language: Language.RU,
      user: { name: 'Dev Me', username: ME, role: JobRole.DEVELOPER, roleName: 'Разработчик' },
      isEmpty: false,
      itemsCount: 1,
      ai: { used: false },
    });
    expect(buildContext(createDay(), { language: Language.EN })).toMatchObject({
      dateText: '9 November',
      weekday: 'Monday',
      isEmpty: true,
      projects: [],
    });
  });

  it('puts the lines into their projects, the more important first, without lines left out', () => {
    const context = buildContext(
      createDay({
        issues: [
          commented(1),
          commented(2, { projectId: 2 }),
          mergedBug(3),
          commented(4, { labels: ['type::ignore'] }),
        ],
      }),
    );

    expect(
      context.projects.map(({ name, url, items }) => [name, url, items.map((item) => item.ref)]),
    ).toEqual([
      ['project-1', `${GITLAB_URL}/group/project-1`, ['#3', '#1']],
      ['project-2', `${GITLAB_URL}/group/project-2`, ['#2']],
    ]);
    expect(context.items.map((item) => item.ref)).toEqual(['#3', '#1', '#2']);
    expect(
      context.groups.map(({ category, name, items }) => [category, name, items.length]),
    ).toEqual([
      [ActivityTier.OUTCOME, 'Итоги', 1],
      [ActivityTier.PARTICIPATION, 'Участие', 2],
    ]);
    expect(context.items[0]).toMatchObject({
      text: 'Исправил баг «Issue 3»',
      actionText: 'Исправил баг',
      title: 'Issue 3',
      note: null,
      action: ActivityAction.MERGED,
      category: ActivityTier.OUTCOME,
      type: TemplateItemType.ISSUE,
      url: `${GITLAB_URL}/group/project-1/-/issues/12`,
      projectName: 'project-1',
    });
  });

  it('replaces the lines of a summary with the summary in their project', () => {
    const context = buildContext(
      createDay({ issues: [planned(1), planned(2), planned(3), planned(4, 2)] }),
      { role: JobRole.PROJECT_MANAGER },
    );

    expect(
      context.projects.map(({ name, items }) => [
        name,
        items.map(({ type, text }) => [type, text]),
      ]),
    ).toEqual([
      ['project-1', [[TemplateItemType.SUMMARY, 'Взял 3 задачи в спринт 5–18 ноября: #1, #2, #3']]],
      ['project-2', [[TemplateItemType.ISSUE, 'Взял задачу в спринт 5–18 ноября «Issue 4»']]],
    ]);
  });

  it('links only to GitLab', () => {
    const context = buildContext(
      createDay({ issues: [commented(1, { webUrl: 'https://elsewhere.example.com/issues/1' })] }),
    );

    expect(context.items[0].url).toBeNull();
  });
});
