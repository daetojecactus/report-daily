import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { DeliveryKind } from 'src/modules/application/delivery/types/delivery.enums';
import { deliveries } from 'src/modules/application/delivery/delivery.schema';
import { ReportStatus } from 'src/modules/application/report/types/report.enums';
import { reports } from 'src/modules/application/report/report.schema';
import { Gender, JobRole } from 'src/modules/application/user/types/user.enums';
import { users } from 'src/modules/application/user/user.schema';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { createTestApp } from 'test/setup/test-app';
import { SystemCleanup } from '../system.cleanup';

describe('SystemCleanup', () => {
  let app: NestFastifyApplication;
  let db: NodePgDatabase;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await db.delete(users);
    const [user] = await db
      .insert(users)
      .values({ displayName: 'Anna', role: JobRole.QA, gender: Gender.FEMALE })
      .returning();
    userId = user.id;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function insertReport(reportDate: string) {
    const [report] = await db
      .insert(reports)
      .values({ userId, reportDate, status: ReportStatus.DELIVERED })
      .returning();
    return report;
  }

  async function insertDelivery(createdAt: Date, reportId: string | null = null) {
    await db.insert(deliveries).values({
      userId,
      channel: Channel.TELEGRAM,
      kind: reportId ? DeliveryKind.REPORT : DeliveryKind.BROADCAST,
      reportId,
      createdAt,
    });
  }

  it('keeps 30 days of reports and deliveries and deletes the older ones', async () => {
    const old = await insertReport('2026-10-10');
    await insertReport('2026-10-11');
    const recent = await insertReport('2026-11-10');
    await insertDelivery(new Date('2026-11-10T10:00:00Z'), old.id);
    await insertDelivery(new Date('2026-11-10T10:00:00Z'), recent.id);
    await insertDelivery(new Date('2026-10-10T10:00:00Z'));
    await insertDelivery(new Date('2026-10-12T10:00:00Z'));
    vi.useFakeTimers({ now: Date.parse('2026-11-10T12:00:00Z'), toFake: ['Date'] });

    expect(await app.get(SystemCleanup).run()).toEqual({ reports: 1, deliveries: 1 });

    expect((await db.select().from(reports)).map(({ reportDate }) => reportDate).sort()).toEqual([
      '2026-10-11',
      '2026-11-10',
    ]);
    expect(await db.select().from(deliveries)).toHaveLength(2);
    expect(await app.get(SystemCleanup).run()).toEqual({ reports: 0, deliveries: 0 });
  });
});
