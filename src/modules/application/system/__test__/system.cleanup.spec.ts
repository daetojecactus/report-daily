import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import type { ReportService } from 'src/modules/application/report/report.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { SystemCleanup } from '../system.cleanup';

describe('SystemCleanup', () => {
  const reportService = { deleteExpired: vi.fn<ReportService['deleteExpired']>() };
  const deliveryService = { deleteExpired: vi.fn<DeliveryService['deleteExpired']>() };
  const cleanup = new SystemCleanup(
    reportService as unknown as ReportService,
    deliveryService as unknown as DeliveryService,
    { get: () => 'Asia/Almaty' } as unknown as ConfigService<AppEnvs, true>,
  );
  const log = vi.fn();

  beforeAll(() => {
    Logger.overrideLogger({ log, error: vi.fn(), warn: vi.fn() });
  });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: Date.parse('2026-11-10T20:00:00Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes by today of the company and the current time and logs what is gone', async () => {
    reportService.deleteExpired.mockResolvedValue(3);
    deliveryService.deleteExpired.mockResolvedValue(0);

    expect(await cleanup.run()).toEqual({ reports: 3, deliveries: 0 });
    expect(reportService.deleteExpired).toHaveBeenCalledWith('2026-11-11');
    expect(deliveryService.deleteExpired).toHaveBeenCalledWith(new Date('2026-11-10T20:00:00Z'));
    expect(log).toHaveBeenCalledOnce();
  });

  it('writes no log when nothing was deleted', async () => {
    reportService.deleteExpired.mockResolvedValue(0);
    deliveryService.deleteExpired.mockResolvedValue(0);

    await cleanup.run();

    expect(log).not.toHaveBeenCalled();
  });
});
