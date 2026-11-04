import { UnrecoverableError } from 'bullmq';

export class TelegramRetryableError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

export class TelegramRejectedError extends UnrecoverableError {
  constructor(
    message: string,
    readonly code: number,
    readonly description: string,
  ) {
    super(message);
  }
}
