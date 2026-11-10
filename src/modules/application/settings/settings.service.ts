import { Injectable } from '@nestjs/common';
import type { ReportsPause, Settings, SettingsUpdate } from './settings.interface';
import { SettingsRepository } from './settings.repository';

@Injectable()
export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  findOne() {
    return this.settingsRepository.findOne();
  }

  update(values: SettingsUpdate) {
    return this.settingsRepository.upsert(values);
  }

  pauseReports(until: string | null) {
    return this.update({ reportsPaused: true, reportsPausedUntil: until });
  }

  resumeReports() {
    return this.update({ reportsPaused: false, reportsPausedUntil: null });
  }

  async findReportsPause(date: string) {
    return this.toReportsPause(await this.findOne(), date);
  }

  toReportsPause(row: Settings | null, date: string): ReportsPause | null {
    if (!row?.reportsPaused) {
      return null;
    }
    const until = row.reportsPausedUntil;
    return until === null || date <= until ? { until } : null;
  }
}
