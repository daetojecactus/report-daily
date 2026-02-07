import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';

@Injectable()
export class GitLabClient {
  private readonly client: AxiosInstance;
  private readonly eventsPerPage: number;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: config.get('SSL_REJECT_UNAUTHORIZED') === 'true',
    });

    this.client = axios.create({
      baseURL: config.get('GITLAB_API_URL'),
      headers: { 'PRIVATE-TOKEN': config.get('GITLAB_API_TOKEN') },
      httpsAgent,
    });

    this.eventsPerPage = parseInt(config.get('EVENTS_PER_PAGE') || '100', 10);
  }

  get instance(): AxiosInstance {
    return this.client;
  }

  getEventsPerPage(): number {
    return this.eventsPerPage;
  }
}
