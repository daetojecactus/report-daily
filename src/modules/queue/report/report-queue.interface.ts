import type { BotTarget } from 'src/modules/application/bot/bot.interface';

export interface ReportJobData {
  userId: string;
  date: string;
  maxAgeMs: number | null;
  reply: BotTarget;
  notices: {
    empty: string;
    failed: string;
  };
}
