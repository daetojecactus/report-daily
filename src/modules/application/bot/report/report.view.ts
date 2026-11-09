import { Injectable } from '@nestjs/common';
import type { Screen, ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { addDays } from 'src/common/utils/date.util';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import type { Report } from 'src/modules/application/report/report.interface';
import { BotNamespace } from '../bot.enums';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import {
  REPORT_DATE_FORMAT,
  REPORT_DATE_TIME_SUFFIX,
  REPORT_DAY_BUTTON_FORMAT,
  REPORT_DAYS_BACK,
  REPORT_DAYS_PER_ROW,
  REPORT_FIRST_OTHER_DAY,
} from './constants/report.constants';
import { ReportAction } from './report.enums';

@Injectable()
export class ReportView {
  toReportScreen(report: Report, locale: Locale): Screen {
    return {
      text: report.content ?? '',
      buttons: [
        [
          {
            text: locale.report.rebuild,
            data: this.toData(ReportAction.REBUILD, report.reportDate),
          },
        ],
      ],
    };
  }

  toMenu(locale: Locale): Screen {
    return {
      text: locale.report.choose,
      buttons: [
        [
          { text: locale.report.today, data: this.toData(ReportAction.DAY, '0') },
          { text: locale.report.yesterday, data: this.toData(ReportAction.DAY, '1') },
        ],
        [{ text: locale.report.otherDay, data: this.toData(ReportAction.DAYS) }],
      ],
    };
  }

  toDays(locale: Locale, today: string): Screen {
    const format = new Intl.DateTimeFormat(locale.phrases.dateLocale, REPORT_DAY_BUTTON_FORMAT);
    const days: ScreenButton[] = [];
    for (let offset = REPORT_FIRST_OTHER_DAY; offset <= REPORT_DAYS_BACK; offset++) {
      days.push({
        text: format.format(this.toInstant(addDays(today, -offset))),
        data: this.toData(ReportAction.DAY, String(offset)),
      });
    }
    const rows: ScreenButton[][] = [];
    for (let index = 0; index < days.length; index += REPORT_DAYS_PER_ROW) {
      rows.push(days.slice(index, index + REPORT_DAYS_PER_ROW));
    }
    return {
      text: locale.report.chooseDay(REPORT_DAYS_BACK),
      buttons: [...rows, [{ text: locale.report.back, data: this.toData(ReportAction.MENU) }]],
    };
  }

  toDayText(locale: Locale, date: string, today: string) {
    if (date === today) {
      return locale.report.todayText;
    }
    if (date === addDays(today, -1)) {
      return locale.report.yesterdayText;
    }
    return new Intl.DateTimeFormat(locale.phrases.dateLocale, REPORT_DATE_FORMAT).format(
      this.toInstant(date),
    );
  }

  private toInstant(date: string) {
    return new Date(`${date}${REPORT_DATE_TIME_SUFFIX}`);
  }

  private toData(...parts: string[]) {
    return [BotNamespace.REPORT, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
