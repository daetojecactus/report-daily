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
  TELEGRAM_DEFAULT_API_URL,
} from './constants/config.constants';
import { TELEGRAM_USER_ID_PATTERN } from 'src/common/constants/telegram.constants';
import { TIME_ZONE_NAME_PATTERN } from 'src/common/constants/time.constants';
import { LogLevel } from './config.enums';

function hasLlmEnv(env: AppEnvs) {
  return LLM_ENV_KEYS.some((key) => Boolean(env[key]));
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

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(ENV_LIST_SEPARATOR)
          .map((id) => id.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayNotEmpty()
  @Matches(TELEGRAM_USER_ID_PATTERN, { each: true })
  OWNER_TELEGRAM_IDS!: string[];

  @IsString()
  @IsNotEmpty()
  TELEGRAM_BOT_TOKEN!: string;

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
