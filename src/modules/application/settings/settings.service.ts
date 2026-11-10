import { Injectable } from '@nestjs/common';
import { SETTINGS_AI_DEFAULTS } from './constants/settings.constants';
import type { ReportsPause, Settings, SettingsAi, SettingsUpdate } from './settings.interface';
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

  async findAi() {
    return this.toAi(await this.findOne());
  }

  toAi(row: Settings | null): SettingsAi {
    return {
      aiEnabled: row?.aiEnabled ?? SETTINGS_AI_DEFAULTS.aiEnabled,
      aiSendCommits: row?.aiSendCommits ?? SETTINGS_AI_DEFAULTS.aiSendCommits,
      aiSendComments: row?.aiSendComments ?? SETTINGS_AI_DEFAULTS.aiSendComments,
    };
  }

  toReportsPause(row: Settings | null, date: string): ReportsPause | null {
    if (!row?.reportsPaused) {
      return null;
    }
    const until = row.reportsPausedUntil;
    return until === null || date <= until ? { until } : null;
  }
}
