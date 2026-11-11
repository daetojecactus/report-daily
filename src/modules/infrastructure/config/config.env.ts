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
  LLM_ENV_KEYS,
  SLACK_APP_TOKEN_PATTERN,
  SLACK_BOT_TOKEN_PATTERN,
  SLACK_ENV_KEYS,
  TELEGRAM_DEFAULT_API_URL,
  TELEGRAM_ENV_KEYS,
} from './constants/config.constants';
import { SLACK_USER_ID_PATTERN } from 'src/common/constants/slack.constants';
import { TELEGRAM_USER_ID_PATTERN } from 'src/common/constants/telegram.constants';
import { TIME_ZONE_NAME_PATTERN } from 'src/common/constants/time.constants';
import { DeliveryMode, LogLevel } from './types/config.enums';

function hasLlmEnv(env: AppEnvs) {
  return LLM_ENV_KEYS.some((key) => Boolean(env[key]));
}

function isSet(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function hasSlackEnv(env: AppEnvs) {
  return SLACK_ENV_KEYS.some((key) => isSet(env[key]));
}

function needsTelegramEnv(env: AppEnvs) {
  return TELEGRAM_ENV_KEYS.some((key) => isSet(env[key])) || !hasSlackEnv(env);
}

function toList({ value }: { value: unknown }) {
  return typeof value === 'string'
    ? value
        .split(ENV_LIST_SEPARATOR)
        .map((id) => id.trim())
        .filter(Boolean)
    : value;
}

export class AppEnvs {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.INFO;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  PORT: number = APP_DEFAULT_PORT;

  @IsTimeZone()
  @Matches(TIME_ZONE_NAME_PATTERN)
  APP_TIMEZONE!: string;

  @Transform(toList)
  @ValidateIf(needsTelegramEnv)
  @IsArray()
  @ArrayNotEmpty()
  @Matches(TELEGRAM_USER_ID_PATTERN, { each: true })
  OWNER_TELEGRAM_IDS?: string[];

  @ValidateIf(needsTelegramEnv)
  @IsString()
  @IsNotEmpty()
  TELEGRAM_BOT_TOKEN?: string;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  TELEGRAM_API_URL: string = TELEGRAM_DEFAULT_API_URL;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  GITLAB_URL!: string;

  @IsString()
  @IsNotEmpty()
  GITLAB_TOKEN!: string;

  @IsEnum(DeliveryMode)
  DELIVERY_MODE: DeliveryMode = DeliveryMode.LIVE;

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

  @ValidateIf(hasLlmEnv)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  LLM_BASE_URL?: string;

  @ValidateIf(hasLlmEnv)
  @IsString()
  @IsNotEmpty()
  LLM_TOKEN?: string;

  @ValidateIf(hasLlmEnv)
  @IsString()
  @IsNotEmpty()
  LLM_MODEL?: string;
}
