import { z } from 'zod';

export const AI_REQUESTS_PER_MINUTE = 10;

export const AI_LIMIT_WINDOW_MS = 60_000;

export const AI_LIMIT_ATTEMPTS = 2;

export const AI_LIMIT_KEY_PREFIX = 'limit:llm:';

export const AI_LINE_MAX_LENGTH = 200;

export const AI_ERROR_MAX_LENGTH = 300;

export const AI_SCHEMA_NAME = 'report_lines';

export const AI_ANSWER_SCHEMA = z.object({
  lines: z.array(z.object({ id: z.string(), text: z.string() })),
});

export const AI_DATA_START = '<data>';

export const AI_DATA_END = '</data>';

export const AI_PROMPT_SEPARATOR = '\n\n';

export const AI_DATA_ESCAPES: [RegExp, string][] = [
  [/</g, '\\u003c'],
  [/>/g, '\\u003e'],
];

export const AI_LINE_BREAK_PATTERN = /[\r\n]/;

export const AI_ESCAPED_MARKUP_PATTERN = /\\([*_`~[\]])/g;

export const AI_MARKUP_PATTERN = /[*`~]+/g;

export const AI_LEAD_PATTERN = /^(?:>\s*|#+\s*|[-•]\s*|\[[^\]]+\]\s*)+/;

export const AI_SPACES_PATTERN = /\s+/g;
