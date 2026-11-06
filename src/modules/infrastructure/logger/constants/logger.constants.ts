const LOGGER_SENSITIVE_KEYS = ['headers', 'authorization', 'token', 'apiKey', 'password'];

export const LOGGER_REDACT_PATHS = LOGGER_SENSITIVE_KEYS.flatMap((key) => [
  key,
  `*.${key}`,
  `*.*.${key}`,
]);

export const LOGGER_REDACT_CENSOR = '[redacted]';
