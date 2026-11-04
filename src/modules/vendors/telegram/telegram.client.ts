import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getFailureReason } from 'src/common/utils/error.util';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import {
  TELEGRAM_REQUEST_TIMEOUT_MS,
  TELEGRAM_SERVER_ERROR,
  TELEGRAM_TOO_MANY_REQUESTS,
  TELEGRAM_URL_TRAILING_SLASHES,
} from './constants/telegram.constants';
import { TelegramMessages } from './constants/telegram.messages';
import type { TelegramMethod } from './telegram.enums';
import {
  TelegramRejectedError,
  TelegramRetryableError,
} from './telegram.error';
import type {
  TelegramCallOptions,
  TelegramResponse,
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

  async call<T>(
    method: TelegramMethod,
    params: object,
    options: TelegramCallOptions = {},
  ): Promise<T> {
    const response = await this.request(method, params, options);
    const body = await this.parse<T>(method, response);
    if (body.ok) {
      return body.result as T;
    }

    const code = body.error_code ?? response.status;
    const message = `${TelegramMessages.API_ERROR}: ${method}: ${code} ${body.description ?? ''}`;
    if (code === TELEGRAM_TOO_MANY_REQUESTS || code >= TELEGRAM_SERVER_ERROR) {
      throw new TelegramRetryableError(
        message,
        body.parameters?.retry_after ?? null,
      );
    }
    throw new TelegramRejectedError(message, code, body.description ?? '');
  }

  private async request(
    method: TelegramMethod,
    params: object,
    { timeoutMs = TELEGRAM_REQUEST_TIMEOUT_MS, signal }: TelegramCallOptions,
  ) {
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      return await fetch(`${this.baseUrl}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error) {
      throw new TelegramRetryableError(
        `${TelegramMessages.REQUEST_FAILED}: ${method}: ${getFailureReason(error)}`,
      );
    }
  }

  private async parse<T>(method: TelegramMethod, response: Response) {
    try {
      return (await response.json()) as TelegramResponse<T>;
    } catch (error) {
      throw new TelegramRetryableError(
        `${TelegramMessages.INVALID_RESPONSE}: ${method}: ${response.status} ${getFailureReason(error)}`,
      );
    }
  }
}
