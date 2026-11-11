import { Logger } from '@nestjs/common';
import type { Worker } from 'bullmq';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUEUE_STOP_TIMEOUT_MS } from '../constants/queue.constants';
import { QueueHost } from '../queue.host';

class TestQueueHost extends QueueHost {
  process() {
    return Promise.resolve();
  }
}

function createHost(close: Promise<void>) {
  const worker = { close: vi.fn<Worker['close']>().mockReturnValue(close) };
  const host = new TestQueueHost();
  Object.assign(host, { _worker: worker });
  const warn = vi.spyOn(Logger.prototype, 'warn');
  return { host, worker, warn };
}

describe('QueueHost', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('closes the worker after its running jobs', async () => {
    const { host, worker, warn } = createHost(Promise.resolve());

    await host.onModuleDestroy();

    expect(worker.close).toHaveBeenCalledWith();
    expect(warn).not.toHaveBeenCalled();
  });

  it('stops waiting for jobs that do not finish in time, so they run again after the restart', async () => {
    const { host, warn } = createHost(new Promise(() => undefined));

    let stopped = false;
    void host.onModuleDestroy().then(() => {
      stopped = true;
    });
    await vi.advanceTimersByTimeAsync(QUEUE_STOP_TIMEOUT_MS - 1);
    expect(stopped).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(stopped).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  });
});
