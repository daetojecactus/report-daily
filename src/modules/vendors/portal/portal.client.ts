import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type { ReportDailyBotEnvs } from '../../infrastructure/config/env';

@Injectable()
export class PortalClient {
  private readonly client: AxiosInstance;

  constructor(
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {
    this.client = axios.create({
      baseURL: this.configService.get('PORTAL_WEBHOOK_URL'),
    });
  }

  get instance(): AxiosInstance {
    return this.client;
  }
}
