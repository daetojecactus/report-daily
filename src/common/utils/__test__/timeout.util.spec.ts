import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finishesWithin } from '../timeout.util';

describe('finishesWithin', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tells whether a promise settles before the time is up', async () => {
    expect(await finishesWithin(Promise.resolve(), 1000)).toBe(true);

    const late = finishesWithin(new Promise(() => undefined), 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await late).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes on a failure that comes in time and ignores one that comes late', async () => {
    await expect(finishesWithin(Promise.reject(new Error('down')), 1000)).rejects.toThrow('down');

    const failing = Promise.withResolvers<void>();
    const late = finishesWithin(failing.promise, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    failing.reject(new Error('down'));
    expect(await late).toBe(false);
  });
});
