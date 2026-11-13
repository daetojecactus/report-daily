import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsTimeZone,
  IsUrl,
  Matches,
  ValidateIf,
} from 'class-validator';
import {
  APP_DEFAULT_PORT,
  ENV_LIST_SEPARATOR,
  ENV_URL_OPTIONS,
  LLM_DEFAULT_REQUESTS_PER_EMPLOYEE_PER_DAY,
  LLM_DEFAULT_REQUESTS_PER_MINUTE,
  LLM_ENV_KEYS,
  SLACK_APP_TOKEN_PATTERN,
  SLACK_BOT_TOKEN_PATTERN,
  SLACK_DEFAULT_API_URL,
  SLACK_ENV_KEYS,
  TELEGRAM_DEFAULT_API_URL,
  TELEGRAM_ENV_KEYS,
} from './constants/config.constants';
import {
  SLACK_USER_ID_PATTERN,
  TELEGRAM_USER_ID_PATTERN,
} from 'src/common/channel/constants/channel.constants';
import { TIME_ZONE_NAME_PATTERN } from 'src/common/constants/time-zone.constants';
import { LlmApi, LogLevel } from './types/config.enums';

function isSet(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function hasLlmEnv(env: AppEnvs) {
  return LLM_ENV_KEYS.some((key) => isSet(env[key]));
}

function hasSlackEnv(env: AppEnvs) {
  return SLACK_ENV_KEYS.some((key) => isSet(env[key]));
}

function needsTelegramEnv(env: AppEnvs) {
  return TELEGRAM_ENV_KEYS.some((key) => isSet(env[key])) || !hasSlackEnv(env);
}

function toList({ value }: { value: unknown }) {
  if (typeof value !== 'string') {
    return value;
  }
  return value
    .split(ENV_LIST_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}

export class AppEnvs {
  @IsTimeZone()
  @Matches(TIME_ZONE_NAME_PATTERN)
  APP_TIMEZONE!: string;

  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.INFO;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  PORT: number = APP_DEFAULT_PORT;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsUrl(ENV_URL_OPTIONS)
  GITLAB_URL!: string;

  @IsString()
  @IsNotEmpty()
  GITLAB_TOKEN!: string;

  @ValidateIf(needsTelegramEnv)
  @IsString()
  @IsNotEmpty()
  TELEGRAM_BOT_TOKEN?: string;

  @Transform(toList)
  @ValidateIf(needsTelegramEnv)
  @IsArray()
  @ArrayNotEmpty()
  @Matches(TELEGRAM_USER_ID_PATTERN, { each: true })
  OWNER_TELEGRAM_IDS?: string[];

  @IsUrl(ENV_URL_OPTIONS)
  TELEGRAM_API_URL: string = TELEGRAM_DEFAULT_API_URL;

  @ValidateIf(hasSlackEnv)
  @Matches(SLACK_BOT_TOKEN_PATTERN)
  SLACK_BOT_TOKEN?: string;

  @ValidateIf(hasSlackEnv)
  @Matches(SLACK_APP_TOKEN_PATTERN)
  SLACK_APP_TOKEN?: string;

  @Transform(toList)
  @ValidateIf(hasSlackEnv)
  @IsArray()
  @ArrayNotEmpty()
  @Matches(SLACK_USER_ID_PATTERN, { each: true })
  OWNER_SLACK_IDS?: string[];

  @IsUrl(ENV_URL_OPTIONS)
  SLACK_API_URL: string = SLACK_DEFAULT_API_URL;

  @IsEnum(LlmApi)
  LLM_API: LlmApi = LlmApi.OPENAI;

  @ValidateIf(hasLlmEnv)
  @IsUrl(ENV_URL_OPTIONS)
  LLM_BASE_URL?: string;

  @ValidateIf(hasLlmEnv)
  @IsString()
  @IsNotEmpty()
  LLM_TOKEN?: string;

  @ValidateIf(hasLlmEnv)
  @IsString()
  @IsNotEmpty()
  LLM_MODEL?: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  LLM_REQUESTS_PER_MINUTE: number = LLM_DEFAULT_REQUESTS_PER_MINUTE;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  LLM_REQUESTS_PER_EMPLOYEE_PER_DAY: number = LLM_DEFAULT_REQUESTS_PER_EMPLOYEE_PER_DAY;
}
