import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { PRODUCTION_CALENDAR_TIMEOUT } from './constants/production-calendar.constants';
import { ProductionCalendarMessages } from './constants/production-calendar.messages';
import { ReportDailyBotEnvs } from 'src/config/env';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProductionCalendarClient {
  private readonly logger = new Logger(ProductionCalendarClient.name);
  private readonly client: AxiosInstance;

  constructor(
    private readonly config: ConfigService<ReportDailyBotEnvs, true>,
  ) {
    this.client = axios.create({
      baseURL: this.config.get('PRODUCTION_CALENDAR_BASE_URL'),
      timeout: PRODUCTION_CALENDAR_TIMEOUT,
      responseType: 'text',
    });
  }

  //загружает HTML-страницу производственного календаря за указанный год
  async fetchCalendarHtml(year: number): Promise<string> {
    try {
      const { data } = await this.client.get<string>(`/${year}`);
      this.logger.log(
        `${ProductionCalendarMessages.PRODUCTION_CALENDAR_FETCH_SUCCESS}: ${year}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `${ProductionCalendarMessages.PRODUCTION_CALENDAR_FETCH_ERROR}: ${year}`,
        error,
      );
      throw error;
    }
  }
}
