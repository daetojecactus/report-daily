import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { createTestApp } from 'test/setup/test-app';
import { settings } from '../settings.schema';
import { SettingsService } from '../settings.service';

describe('SettingsService', () => {
  let app: NestFastifyApplication;
  let db: NodePgDatabase;
  let settingsService: SettingsService;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
    settingsService = app.get(SettingsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await db.delete(settings);
  });

  it('has no pause before anything is set', async () => {
    expect(await settingsService.findOne()).toBeNull();
    expect(await settingsService.findReportsPause('2026-11-10')).toBeNull();
  });

  it('keeps one row through a pause until a day, a pause with no end and a resume', async () => {
    await settingsService.pauseReports('2026-11-20');
    expect(await settingsService.findReportsPause('2026-11-20')).toEqual({ until: '2026-11-20' });
    expect(await settingsService.findReportsPause('2026-11-21')).toBeNull();

    await settingsService.pauseReports(null);
    expect(await settingsService.findReportsPause('2030-01-01')).toEqual({ until: null });

    await settingsService.resumeReports();
    expect(await settingsService.findReportsPause('2026-11-10')).toBeNull();
    expect(await db.select().from(settings)).toEqual([
      expect.objectContaining({ id: 1, reportsPaused: false, reportsPausedUntil: null }),
    ]);
  });

  it('has the AI defaults before anything is set and keeps a change', async () => {
    expect(await settingsService.findAi()).toEqual({
      aiEnabled: true,
      aiSendCommits: true,
      aiSendComments: false,
    });

    await settingsService.pauseReports(null);
    await settingsService.update({ aiSendComments: true });
    expect(await settingsService.findAi()).toEqual({
      aiEnabled: true,
      aiSendCommits: true,
      aiSendComments: true,
    });
  });

  it('refuses a second row', async () => {
    await expect(db.insert(settings).values({ id: 2 })).rejects.toThrow();
  });
});
