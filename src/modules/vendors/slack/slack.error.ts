import { UnrecoverableError } from 'bullmq';

export class SlackRejectedError extends UnrecoverableError {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}
