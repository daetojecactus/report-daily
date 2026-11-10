import { LlmFormat } from '../llm.enums';

export const LLM_TIMEOUT_MS = 30_000;

export const LLM_MAX_RETRIES = 2;

export const LLM_TEMPERATURE = 0.2;

export const LLM_FORMATS = [LlmFormat.JSON_SCHEMA, LlmFormat.JSON_OBJECT, LlmFormat.TEXT];

export const LLM_FORMAT_REJECTED_STATUSES = [400, 422];

export const LLM_JSON_START = '{';

export const LLM_JSON_END = '}';
