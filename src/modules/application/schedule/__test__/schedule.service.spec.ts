import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/enums/channel.enums';
import type { Report } from 'src/modules/application/report/report.interface';
import type { ReportService } from 'src/modules/application/report/report.service';
import type { Settings } from 'src/modules/application/settings/settings.interface';
import type { SettingsRepository } from 'src/modules/application/settings/settings.repository';
import { SettingsService } from 'src/modules/application/settings/settings.service';
import type { User } from 'src/modules/application/user/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import type { ReportQueueProducer } from 'src/modules/queue/report/report-queue.producer';
import { ScheduleService } from '../schedule.service';

function user(id: string, values: Partial<User> = {}): User {
  return { id, reportTime: '18:00:00', timezone: null, ...values } as User;
}

describe('ScheduleService', () => {
  const userService = { findScheduled: vi.fn<UserService['findScheduled']>() };
  const reportService = {
    claimScheduled: vi.fn<ReportService['claimScheduled']>(),
    releaseScheduled: vi.fn<ReportService['releaseScheduled']>(),
  };
  const settingsRepository = { findOne: vi.fn<SettingsRepository['findOne']>() };
  const producer = { addReport: vi.fn<ReportQueueProducer['addReport']>() };
  const service = new ScheduleService(
    userService as unknown as UserService,
    reportService as unknown as ReportService,
    new SettingsService(settingsRepository as unknown as SettingsRepository),
    producer as unknown as ReportQueueProducer,
    { get: () => 'Asia/Almaty' } as unknown as ConfigService<AppEnvs, true>,
  );
  const queuedDates = () => producer.addReport.mock.calls.map(([data]) => data.date);

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    settingsRepository.findOne.mockResolvedValue(null as unknown as Settings);
    reportService.claimScheduled.mockResolvedValue({} as Report);
  });

  it('queues the report of today from the report time for three hours', async () => {
    userService.findScheduled.mockResolvedValue([user('anna')]);

    for (const now of ['2026-11-10T12:45:00Z', '2026-11-10T16:00:00Z']) {
      expect(await service.tick(new Date(now))).toBe(0);
    }
    for (const now of ['2026-11-10T13:00:00Z', '2026-11-10T15:45:00Z']) {
      expect(await service.tick(new Date(now))).toBe(1);
    }

    expect(userService.findScheduled).toHaveBeenCalledWith(Channel.TELEGRAM);
    expect(reportService.claimScheduled).toHaveBeenCalledWith(
      'anna',
      '2026-11-10',
      new Date('2026-11-10T13:00:00Z'),
    );
    expect(producer.addReport).toHaveBeenCalledWith({
      userId: 'anna',
      date: '2026-11-10',
      maxAgeMs: 300_000,
      own: false,
      notice: null,
    });
    expect(queuedDates()).toEqual(['2026-11-10', '2026-11-10']);
  });

  it('takes the time zone of the employee and APP_TIMEZONE without one', async () => {
    userService.findScheduled.mockResolvedValue([
      user('anna'),
      user('john', { timezone: 'Europe/London' }),
    ]);

    expect(await service.tick(new Date('2026-11-10T18:00:00Z'))).toBe(1);
    expect(producer.addReport).toHaveBeenCalledWith(expect.objectContaining({ userId: 'john' }));
  });

  it('catches up after midnight with the report of the day before', async () => {
    userService.findScheduled.mockResolvedValue([user('anna', { reportTime: '23:00:00' })]);

    expect(await service.tick(new Date('2026-11-10T19:30:00Z'))).toBe(1);
    expect(queuedDates()).toEqual(['2026-11-10']);
  });

  it('skips a paused day and a report already claimed', async () => {
    userService.findScheduled.mockResolvedValue([user('anna')]);
    settingsRepository.findOne.mockResolvedValueOnce({
      reportsPaused: true,
      reportsPausedUntil: '2026-11-10',
    } as Settings);

    expect(await service.tick(new Date('2026-11-10T13:00:00Z'))).toBe(0);
    expect(reportService.claimScheduled).not.toHaveBeenCalled();

    reportService.claimScheduled.mockResolvedValueOnce(null as unknown as Report);
    expect(await service.tick(new Date('2026-11-10T13:15:00Z'))).toBe(0);
    expect(producer.addReport).not.toHaveBeenCalled();
  });

  it('releases the claim when the report cannot be queued and goes on', async () => {
    userService.findScheduled.mockResolvedValue([user('anna'), user('olga')]);
    producer.addReport.mockRejectedValueOnce(new Error('Redis is down'));

    expect(await service.tick(new Date('2026-11-10T13:00:00Z'))).toBe(1);
    expect(reportService.releaseScheduled).toHaveBeenCalledWith('anna', '2026-11-10');
    expect(producer.addReport).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: 'olga' }),
    );
  });
});
