import type { Language } from 'src/modules/application/i18n/i18n.enums';
import type { BotTarget } from 'src/modules/application/bot/bot.interface';

export interface ReportJobData {
  userId: string;
  date: string;
  language: Language;
  reply: BotTarget;
}
