import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getFailureReason } from 'src/common/utils/error.util';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import {
  TELEGRAM_REQUEST_TIMEOUT_MS,
  TELEGRAM_URL_TRAILING_SLASHES,
} from './constants/telegram.constants';
import { TelegramMessages } from './constants/telegram.messages';
import type { TelegramMethod } from './telegram.enums';
import { TelegramRetryableError } from './telegram.error';
import type {
  TelegramCallOptions,
  TelegramHttpResponse,
} from './telegram.interface';

@Injectable()
export class TelegramClient {
  private readonly baseUrl: string;

  constructor(configService: ConfigService<AppEnvs, true>) {
    const apiUrl = configService
      .get('TELEGRAM_API_URL', { infer: true })
      .replace(TELEGRAM_URL_TRAILING_SLASHES, '');
    const token = configService.get('TELEGRAM_BOT_TOKEN', { infer: true });
    this.baseUrl = `${apiUrl}/bot${token}`;
  }

  async post(
    method: TelegramMethod,
    params: object,
    {
      timeoutMs = TELEGRAM_REQUEST_TIMEOUT_MS,
      signal,
    }: TelegramCallOptions = {},
  ): Promise<TelegramHttpResponse> {
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      return { status: response.status, body: await response.text() };
    } catch (error) {
      throw new TelegramRetryableError(
        `${TelegramMessages.REQUEST_FAILED}: ${method}: ${getFailureReason(error)}`,
      );
    }
  }
}
