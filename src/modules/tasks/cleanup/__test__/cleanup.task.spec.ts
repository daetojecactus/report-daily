import { Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemCleanup } from 'src/modules/application/system/system.cleanup';
import { ScheduleRootModule } from 'src/modules/infrastructure/scheduler/schedule-root.module';
import { CleanupTask } from '../cleanup.task';

describe('CleanupTask', () => {
  const systemCleanup = { run: vi.fn<SystemCleanup['run']>() };
  const task = new CleanupTask(systemCleanup as unknown as SystemCleanup);

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('runs every night at 03:00', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleRootModule],
      providers: [CleanupTask, { provide: SystemCleanup, useValue: systemCleanup }],
    }).compile();
    await moduleRef.init();

    expect(moduleRef.get(SchedulerRegistry).getCronJob('cleanup').cronTime.source).toBe(
      '0 3 * * *',
    );
    await moduleRef.close();
  });

  it('runs the cleanup', async () => {
    await task.handleCleanup();

    expect(systemCleanup.run).toHaveBeenCalledOnce();
  });

  it('logs a failed cleanup instead of throwing', async () => {
    systemCleanup.run.mockRejectedValue(new Error('Database is down'));

    await expect(task.handleCleanup()).resolves.toBeUndefined();
  });
});
