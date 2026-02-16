import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import type { ReportDailyBotEnvs } from '../../../config/env';

const DEFAULT_EVENTS_PER_PAGE = 100;

@Injectable()
export class GitLabClient {
  private readonly client: AxiosInstance;
  private readonly eventsPerPage: number;

  constructor(
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    this.client = axios.create({
      baseURL: this.configService.get('GITLAB_API_URL'),
      headers: { 'PRIVATE-TOKEN': this.configService.get('GITLAB_API_TOKEN') },
      httpsAgent,
    });

    this.eventsPerPage = DEFAULT_EVENTS_PER_PAGE;
  }

  get instance(): AxiosInstance {
    return this.client;
  }

  getEventsPerPage(): number {
    return this.eventsPerPage;
  }
}
