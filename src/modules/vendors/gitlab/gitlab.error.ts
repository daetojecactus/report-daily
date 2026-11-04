import { UnrecoverableError } from 'bullmq';

export class GitLabRetryableError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

export class GitLabRejectedError extends UnrecoverableError {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
