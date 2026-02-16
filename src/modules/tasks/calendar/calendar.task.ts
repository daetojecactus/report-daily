import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HolidayCalendarService } from '../../application/holiday-calendar/holiday-calendar.service';
import { BotSettingsService } from '../../application/bot-settings/bot-settings.service';
import { HolidayCalendarMessages } from '../../application/holiday-calendar/constants/holiday-calendar.messages';
import { CalendarTaskMessages } from './constants/calendar-task.messages';
import { BOT_SETTINGS_KEY } from 'src/modules/application/bot-settings/constants/bot-settings.constants';

@Injectable()
export class CalendarTask {
  private readonly logger = new Logger(CalendarTask.name);

  constructor(
    private readonly holidayCalendarService: HolidayCalendarService,
    private readonly botSettingsService: BotSettingsService,
  ) {}

  //каждый день в 05:00 проверяем: рабочий сегодня день или нет
  @Cron('0 5 * * *')
  async handleDailyCalendarCheck(): Promise<void> {
    this.logger.log(CalendarTaskMessages.CALENDAR_CHECK_STARTED);

    //если бот принудительно заблокирован — не трогаем isActive
    const settings = await this.botSettingsService.findOne({
      key: BOT_SETTINGS_KEY,
    });

    if (settings.isForceBlocked) {
      return;
    }

    await this.checkTodayAndUpdateBotStatus();
  }

  //каждое 1 января в 04:00 принудительно загружаем календарь нового года
  @Cron('0 4 1 1 *')
  async handleNewYearCalendarFetch(): Promise<void> {
    const year = new Date().getFullYear();
    this.logger.log(`${CalendarTaskMessages.NEW_YEAR_FETCH}: ${year}`);
    await this.holidayCalendarService.fetchAndSaveCalendar(year);
  }

  //проверяет сегодняшний день и включает/выключает бота
  async checkTodayAndUpdateBotStatus(): Promise<void> {
    const today = new Date();
    const isHoliday = await this.holidayCalendarService.isHoliday(today);

    if (isHoliday) {
      this.logger.log(
        HolidayCalendarMessages.HOLIDAY_CALENDAR_TODAY_IS_HOLIDAY,
      );
      await this.botSettingsService.deactivate(
        CalendarTaskMessages.REASON_NON_WORKING_DAY,
      );
    } else {
      this.logger.log(
        HolidayCalendarMessages.HOLIDAY_CALENDAR_TODAY_IS_WORKDAY,
      );
      await this.botSettingsService.activate();
    }
  }
}
