import type { BotTarget } from 'src/modules/application/bot/bot.interface';

export interface ReportJobNotice {
  target: BotTarget;
  empty: string;
  failed: string;
}

export interface ReportJobData {
  userId: string;
  date: string;
  maxAgeMs: number | null;
  notice: ReportJobNotice | null;
}
