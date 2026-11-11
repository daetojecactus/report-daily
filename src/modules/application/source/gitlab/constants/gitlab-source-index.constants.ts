import { z } from 'zod';

export const GITLAB_SOURCE_LOOKBACK_DAYS = 30;

export const GITLAB_SOURCE_INDEX_KEY = 'source:gitlab:day';

export const GITLAB_SOURCE_INDEX_TTL_MS = 900_000;

export const GITLAB_SOURCE_SCAN_LIMIT = 300;

export const GITLAB_SOURCE_INDEX_SCHEMA = z.record(
  z.string(),
  z.object({
    issues: z.array(z.number().int()),
    mergeRequests: z.array(z.number().int()),
  }),
);
