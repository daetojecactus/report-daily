import type { Job } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleService } from 'src/modules/application/schedule/schedule.service';
import type { SystemCleanup } from 'src/modules/application/system/system.cleanup';
import { SYSTEM_CLEANUP_JOB, SYSTEM_SCHEDULE_TICK_JOB } from '../constants/system-queue.constants';
import { SystemQueueProcessor } from '../system-queue.processor';

describe('SystemQueueProcessor', () => {
  const scheduleService = { tick: vi.fn<ScheduleService['tick']>() };
  const systemCleanup = { run: vi.fn<SystemCleanup['run']>() };
  const processor = new SystemQueueProcessor(
    scheduleService as unknown as ScheduleService,
    systemCleanup as unknown as SystemCleanup,
  );
  const run = (name: string) => processor.process({ name } as Job);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the schedule tick at the current time', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-10T13:00:00Z') });

    await run(SYSTEM_SCHEDULE_TICK_JOB);

    expect(scheduleService.tick).toHaveBeenCalledWith(new Date('2026-11-10T13:00:00Z'));
    expect(systemCleanup.run).not.toHaveBeenCalled();
  });

  it('runs the cleanup', async () => {
    await run(SYSTEM_CLEANUP_JOB);

    expect(systemCleanup.run).toHaveBeenCalledOnce();
    expect(scheduleService.tick).not.toHaveBeenCalled();
  });

  it('refuses an unknown job', async () => {
    await expect(run('other')).rejects.toThrow('Unknown system job: other');
  });
});
