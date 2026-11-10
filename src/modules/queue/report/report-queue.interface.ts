import type { Channel } from 'src/common/enums/channel.enums';
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
  own: boolean;
  channel: Channel | null;
  notice: ReportJobNotice | null;
}
