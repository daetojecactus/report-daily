import { Injectable } from '@nestjs/common';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import type { ReportsPause } from 'src/modules/application/settings/types/settings.interface';
import {
  ADMIN_SETTINGS_DATE_FORMAT,
  ADMIN_SETTINGS_DATE_TIME_SUFFIX,
} from './constants/admin-settings.constants';

@Injectable()
export class AdminSettingsView {
  toPauseState(locale: Locale, pause: ReportsPause | null, today: string) {
    const texts = locale.adminSettings;
    if (!pause) {
      return texts.reportsOn;
    }
    if (pause.until === null) {
      return texts.pausedForever;
    }
    if (pause.until === today) {
      return texts.pausedToday;
    }
    return texts.pausedUntil(
      new Intl.DateTimeFormat(locale.phrases.dateLocale, ADMIN_SETTINGS_DATE_FORMAT).format(
        this.toInstant(pause.until),
      ),
    );
  }

  toInstant(date: string) {
    return new Date(`${date}${ADMIN_SETTINGS_DATE_TIME_SUFFIX}`);
  }
}
