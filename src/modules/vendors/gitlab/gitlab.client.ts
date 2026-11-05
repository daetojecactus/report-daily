import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getFailureReason } from 'src/common/utils/error.util';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import {
  GITLAB_API_PATH,
  GITLAB_CERTIFICATE_ERROR_CODES,
  GITLAB_MAX_CONCURRENT_REQUESTS,
  GITLAB_REQUEST_TIMEOUT_MS,
  GITLAB_TOKEN_HEADER,
  GITLAB_URL_TRAILING_SLASHES,
} from './constants/gitlab.constants';
import { GitLabMessages } from './constants/gitlab.messages';
import { GitLabCertificateError, GitLabRetryableError } from './gitlab.error';
import type { GitLabHttpResponse, GitLabQuery } from './gitlab.interface';

@Injectable()
export class GitLabClient {
  private readonly apiUrl: string;
  private readonly token: string;
  private activeRequests = 0;
  private readonly waitingRequests: (() => void)[] = [];

  constructor(configService: ConfigService<AppEnvs, true>) {
    const url = configService
      .get('GITLAB_URL', { infer: true })
      .replace(GITLAB_URL_TRAILING_SLASHES, '');
    this.apiUrl = `${url}${GITLAB_API_PATH}`;
    this.token = configService.get('GITLAB_TOKEN', { infer: true });
  }

  async get(path: string, query: GitLabQuery = {}) {
    await this.takeSlot();
    try {
      return await this.request(path, query);
    } finally {
      this.releaseSlot();
    }
  }

  private async request(
    path: string,
    query: GitLabQuery,
  ): Promise<GitLabHttpResponse> {
    const url = new URL(`${this.apiUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }

    try {
      const response = await fetch(url, {
        headers: { [GITLAB_TOKEN_HEADER]: this.token },
        signal: AbortSignal.timeout(GITLAB_REQUEST_TIMEOUT_MS),
      });
      return {
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        body: await response.text(),
      };
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

  private async takeSlot() {
    if (this.activeRequests < GITLAB_MAX_CONCURRENT_REQUESTS) {
      this.activeRequests += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waitingRequests.push(resolve));
  }

  private releaseSlot() {
    const next = this.waitingRequests.shift();
    if (next) {
      next();
      return;
    }
    this.activeRequests -= 1;
  }
}
