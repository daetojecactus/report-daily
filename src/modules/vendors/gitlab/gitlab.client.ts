import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getFailureReason } from 'src/common/utils/error.util';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import {
  GITLAB_API_PATH,
  GITLAB_CERTIFICATE_ERROR_CODES,
  GITLAB_NOT_FOUND,
  GITLAB_REQUEST_TIMEOUT_MS,
  GITLAB_RETRY_AFTER_HEADER,
  GITLAB_SERVER_ERROR,
  GITLAB_TOKEN_HEADER,
  GITLAB_TOO_MANY_REQUESTS,
  GITLAB_URL_TRAILING_SLASHES,
} from './constants/gitlab.constants';
import { GitLabMessages } from './constants/gitlab.messages';
import {
  GitLabCertificateError,
  GitLabRejectedError,
  GitLabRetryableError,
} from './gitlab.error';
import type { GitLabQuery } from './gitlab.interface';

@Injectable()
export class GitLabClient {
  private readonly apiUrl: string;
  private readonly token: string;

  constructor(configService: ConfigService<AppEnvs, true>) {
    const url = configService
      .get('GITLAB_URL', { infer: true })
      .replace(GITLAB_URL_TRAILING_SLASHES, '');
    this.apiUrl = `${url}${GITLAB_API_PATH}`;
    this.token = configService.get('GITLAB_TOKEN', { infer: true });
  }

  async get<T>(path: string, query: GitLabQuery = {}): Promise<T | null> {
    const response = await this.request(path, query);
    if (response.status === GITLAB_NOT_FOUND) {
      await response.body?.cancel();
      return null;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw this.toError(path, response);
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new GitLabRetryableError(
        `${GitLabMessages.INVALID_RESPONSE}: ${path}: ${getFailureReason(error)}`,
      );
    }
  }

  private async request(path: string, query: GitLabQuery) {
    const url = new URL(`${this.apiUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }

    try {
      return await fetch(url, {
        headers: { [GITLAB_TOKEN_HEADER]: this.token },
        signal: AbortSignal.timeout(GITLAB_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = getFailureReason(error);
      if (GITLAB_CERTIFICATE_ERROR_CODES.has(reason)) {
        throw new GitLabCertificateError(
          `${GitLabMessages.CERTIFICATE_UNTRUSTED}: ${path}: ${reason}`,
        );
      }
      throw new GitLabRetryableError(
        `${GitLabMessages.REQUEST_FAILED}: ${path}: ${reason}`,
      );
    }
  }

  private toError(path: string, response: Response) {
    const message = `${GitLabMessages.API_ERROR}: ${path}: ${response.status}`;
    if (
      response.status === GITLAB_TOO_MANY_REQUESTS ||
      response.status >= GITLAB_SERVER_ERROR
    ) {
      const retryAfter = Number(
        response.headers.get(GITLAB_RETRY_AFTER_HEADER),
      );
      return new GitLabRetryableError(
        message,
        Number.isInteger(retryAfter) && retryAfter > 0 ? retryAfter : null,
      );
    }
    return new GitLabRejectedError(message, response.status);
  }
}
