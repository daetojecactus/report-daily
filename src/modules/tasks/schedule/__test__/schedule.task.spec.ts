import { Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleService } from 'src/modules/application/schedule/schedule.service';
import { ScheduleRootModule } from 'src/modules/infrastructure/scheduler/schedule-root.module';
import { ScheduleTask } from '../schedule.task';

describe('ScheduleTask', () => {
  const scheduleService = { tick: vi.fn<ScheduleService['tick']>() };
  const task = new ScheduleTask(scheduleService as unknown as ScheduleService);

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs every 15 minutes at the quarters of an hour', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleRootModule],
      providers: [ScheduleTask, { provide: ScheduleService, useValue: scheduleService }],
    }).compile();
    await moduleRef.init();

    expect(moduleRef.get(SchedulerRegistry).getCronJob('schedule-tick').cronTime.source).toBe(
      '*/15 * * * *',
    );
    await moduleRef.close();
  });

  it('ticks the schedule at the current time', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-10T13:00:00Z') });

    await task.handleTick();

    expect(scheduleService.tick).toHaveBeenCalledWith(new Date('2026-11-10T13:00:00Z'));
  });

  it('logs a failed tick instead of throwing', async () => {
    scheduleService.tick.mockRejectedValue(new Error('Database is down'));

    await expect(task.handleTick()).resolves.toBeUndefined();
  });
});
