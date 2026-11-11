import type { Channel } from 'src/common/channel/types/channel.enums';
import type { BotTarget } from 'src/modules/application/bot/core/types/bot.interface';

interface ReportJobNotice {
  target: BotTarget;
  empty: string;
  failed: string;
}

export interface ReportJobData {
  userId: string;
  date: string;
  maxAgeMs: number | null;
  channel: Channel | null;
  notice: ReportJobNotice | null;
}
