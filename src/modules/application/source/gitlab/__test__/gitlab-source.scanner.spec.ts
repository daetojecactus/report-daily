import { Logger } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDayRange } from 'src/common/utils/date.util';
import type { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import { GitLabIssuable } from 'src/modules/vendors/gitlab/gitlab.enums';
import type { GitLabLabelEvent, GitLabNote } from 'src/modules/vendors/gitlab/gitlab.interface';
import type { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import { GitLabSourceScanner } from '../gitlab-source.scanner';
import {
  createAuthor,
  createLabelEvent,
  createNote,
  PROJECT_ID,
  REPORT_DATE,
} from './gitlab-source.fixture';

const DAY = getDayRange(REPORT_DATE, 'UTC');
const EMPLOYEE = createAuthor('analyst');
const OTHER = createAuthor('developer');
const INDEX_KEY = `source:gitlab:day:${PROJECT_ID}:${DAY.start}`;

describe('GitLabSourceScanner', () => {
  const gitlabService = {
    findRecentProjectIds: vi.fn<GitLabService['findRecentProjectIds']>(),
    findUpdatedItems: vi.fn<GitLabService['findUpdatedItems']>(),
    findNotes: vi.fn<GitLabService['findNotes']>(),
    findLabelEvents: vi.fn<GitLabService['findLabelEvents']>(),
  };
  const redisService = {
    get: vi.fn<RedisService['get']>(),
    set: vi.fn<RedisService['set']>(),
  };
  const scanner = new GitLabSourceScanner(
    gitlabService as unknown as GitLabService,
    redisService as unknown as RedisService,
  );

  function history(
    notes: Record<number, GitLabNote[]>,
    labelEvents: Record<number, GitLabLabelEvent[]> = {},
  ) {
    gitlabService.findNotes.mockImplementation((_issuable, _projectId, iid) =>
      Promise.resolve(notes[iid] ?? []),
    );
    gitlabService.findLabelEvents.mockImplementation((_issuable, _projectId, iid) =>
      Promise.resolve(labelEvents[iid] ?? []),
    );
  }

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    gitlabService.findRecentProjectIds.mockResolvedValue([PROJECT_ID]);
    redisService.get.mockResolvedValue(null);
    gitlabService.findUpdatedItems.mockImplementation((issuable) =>
      Promise.resolve(
        issuable === GitLabIssuable.ISSUES
          ? [
              { iid: 12, project_id: PROJECT_ID },
              { iid: 13, project_id: PROJECT_ID },
              { iid: 14, project_id: PROJECT_ID },
            ]
          : [{ iid: 5, project_id: PROJECT_ID }],
      ),
    );
  });

  it('finds the items the employee changed on the day', async () => {
    history(
      {
        12: [createNote({ author: EMPLOYEE, body: 'changed the description' })],
        13: [
          createNote({ author: OTHER }),
          createNote({
            author: EMPLOYEE,
            created_at: '2026-08-01T10:00:00.000Z',
          }),
        ],
        5: [createNote({ author: EMPLOYEE, body: 'approved this merge request' })],
      },
      { 14: [createLabelEvent({ user: EMPLOYEE })] },
    );

    expect(await scanner.findHiddenItems(EMPLOYEE.id, REPORT_DATE, DAY)).toEqual({
      issues: [
        { projectId: PROJECT_ID, iid: 12 },
        { projectId: PROJECT_ID, iid: 14 },
      ],
      mergeRequests: [{ projectId: PROJECT_ID, iid: 5 }],
    });
    expect(gitlabService.findRecentProjectIds).toHaveBeenCalledWith(EMPLOYEE.id, REPORT_DATE, 30);
    expect(gitlabService.findUpdatedItems).toHaveBeenCalledWith(
      GitLabIssuable.ISSUES,
      PROJECT_ID,
      `${REPORT_DATE}T00:00:00.000Z`,
    );
  });

  it('keeps the index of the project for every employee for 15 minutes', async () => {
    history({ 12: [createNote({ author: OTHER })] });

    await scanner.findHiddenItems(EMPLOYEE.id, REPORT_DATE, DAY);

    expect(redisService.set).toHaveBeenCalledWith(
      INDEX_KEY,
      JSON.stringify({
        [OTHER.id]: { issues: [12], mergeRequests: [] },
      }),
      900_000,
    );
  });

  it('reads the index from the cache without asking GitLab', async () => {
    redisService.get.mockResolvedValue(
      JSON.stringify({ [EMPLOYEE.id]: { issues: [3], mergeRequests: [9] } }),
    );

    expect(await scanner.findHiddenItems(EMPLOYEE.id, REPORT_DATE, DAY)).toEqual({
      issues: [{ projectId: PROJECT_ID, iid: 3 }],
      mergeRequests: [{ projectId: PROJECT_ID, iid: 9 }],
    });
    expect(redisService.get).toHaveBeenCalledWith(INDEX_KEY);
    expect(gitlabService.findUpdatedItems).not.toHaveBeenCalled();
  });

  it('builds the index again when the cached one is broken', async () => {
    redisService.get.mockResolvedValue('{"broken":');
    history({ 12: [createNote({ author: EMPLOYEE })] });

    expect((await scanner.findHiddenItems(EMPLOYEE.id, REPORT_DATE, DAY)).issues).toEqual([
      { projectId: PROJECT_ID, iid: 12 },
    ]);
  });

  it('scans at most 300 items of a project and warns about the rest', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    gitlabService.findUpdatedItems.mockImplementation((issuable) =>
      Promise.resolve(
        issuable === GitLabIssuable.ISSUES
          ? Array.from({ length: 301 }, (_, index) => ({
              iid: index + 1,
              project_id: PROJECT_ID,
            }))
          : [],
      ),
    );
    history({});

    await scanner.findHiddenItems(EMPLOYEE.id, REPORT_DATE, DAY);

    expect(gitlabService.findNotes).toHaveBeenCalledTimes(300);
    expect(warn).toHaveBeenCalledWith(
      { projectId: PROJECT_ID, items: 301 },
      'Too many updated items in a project, the rest is not scanned',
    );
    warn.mockRestore();
  });

  it('asks nothing more without recent projects', async () => {
    gitlabService.findRecentProjectIds.mockResolvedValue([]);

    expect(await scanner.findHiddenItems(EMPLOYEE.id, REPORT_DATE, DAY)).toEqual({
      issues: [],
      mergeRequests: [],
    });
    expect(redisService.get).not.toHaveBeenCalled();
  });
});
