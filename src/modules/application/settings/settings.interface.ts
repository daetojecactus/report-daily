import type { settings } from './settings.schema';

export type Settings = typeof settings.$inferSelect;

export type SettingsAi = Pick<Settings, 'aiEnabled' | 'aiSendCommits' | 'aiSendComments'>;

export type SettingsUpdate = Partial<
  Pick<Settings, 'reportsPaused' | 'reportsPausedUntil'> & SettingsAi
>;

export interface ReportsPause {
  until: string | null;
}
