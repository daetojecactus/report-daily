import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
} from 'class-validator';
import { APP_DEFAULT_PORT } from './constants/config.constants';
import { LogLevel } from './config.enums';

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
}
