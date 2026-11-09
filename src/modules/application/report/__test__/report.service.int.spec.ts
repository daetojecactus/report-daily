import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { Source } from 'src/modules/application/source/source.enums';
import { Gender, JobRole } from 'src/modules/application/user/user.enums';
import { users } from 'src/modules/application/user/user.schema';
import { userSources } from 'src/modules/application/user/user-source/user-source.schema';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { createTestApp } from 'test/setup/test-app';
import { ReportComposer } from '../report.composer';
import { ReportStatus } from '../report.enums';
import type { ReportDraft } from '../report.interface';
import { reports } from '../report.schema';
import { ReportService } from '../report.service';
import type { ReportContext } from '../template/template.interface';

const DATE = '2026-11-09';

function draft(itemsCount: number, content: string) {
  return {
    context: { version: 1, isEmpty: itemsCount === 0, itemsCount } as ReportContext,
    content,
  } as ReportDraft;
}

describe('ReportService', () => {
  let app: NestFastifyApplication;
  let db: NodePgDatabase;
  let reportService: ReportService;
  let compose: MockInstance<ReportComposer['compose']>;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
    reportService = app.get(ReportService);
    compose = vi.spyOn(app.get(ReportComposer), 'compose');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await db.delete(users);
    const [user] = await db
      .insert(users)
      .values({
        displayName: 'Dev Me',
        role: JobRole.DEVELOPER,
        gender: Gender.MALE,
        language: Language.RU,
      })
      .returning();
    await db
      .insert(userSources)
      .values({ userId: user.id, source: Source.GITLAB, externalId: '21', username: 'dev.me' });
    userId = user.id;
  });

  afterEach(() => {
    compose.mockReset();
  });

  it('builds the report of a day once and keeps the newest text', async () => {
    compose.mockResolvedValueOnce(draft(1, 'project:\n• Fixed a bug'));
    compose.mockResolvedValueOnce(draft(2, 'project:\n• Fixed a bug\n• Left a comment'));

    expect(await reportService.build(userId, DATE)).toMatchObject({
      status: ReportStatus.READY,
      content: 'project:\n• Fixed a bug',
      snapshot: { version: 1, itemsCount: 1 },
    });
    await reportService.build(userId, DATE);

    const stored = await db.select().from(reports);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      reportDate: DATE,
      status: ReportStatus.READY,
      content: 'project:\n• Fixed a bug\n• Left a comment',
      error: null,
    });
    expect(stored[0].generatedAt).toBeInstanceOf(Date);
    expect(compose).toHaveBeenCalledWith(
      expect.objectContaining({ date: DATE, language: Language.RU }),
    );
  });

  it('marks a day without lines empty', async () => {
    compose.mockResolvedValueOnce(draft(0, ''));

    expect(await reportService.build(userId, DATE)).toMatchObject({
      status: ReportStatus.EMPTY,
    });
  });

  it('keeps the last text and the error when a build fails', async () => {
    compose.mockResolvedValueOnce(draft(1, 'project:\n• Fixed a bug'));
    compose.mockRejectedValueOnce(new Error('GitLab answered 502'));

    await reportService.build(userId, DATE);
    await expect(reportService.build(userId, DATE)).rejects.toThrow('GitLab answered 502');

    expect(await reportService.findByDate(userId, DATE)).toMatchObject({
      status: ReportStatus.FAILED,
      content: 'project:\n• Fixed a bug',
      error: 'GitLab answered 502',
    });
  });

  it('refuses an employee without a GitLab account', async () => {
    await db.delete(userSources);

    await expect(reportService.build(userId, DATE)).rejects.toThrow();
    expect(compose).not.toHaveBeenCalled();
  });
});
