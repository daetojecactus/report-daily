import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { AppEnvs } from '../config/config.env';
import {
  LOGGER_REDACT_CENSOR,
  LOGGER_REDACT_PATHS,
} from './constants/logger.constants';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvs, true>) => ({
        pinoHttp: {
          level: configService.get('LOG_LEVEL', { infer: true }),
          redact: { paths: LOGGER_REDACT_PATHS, censor: LOGGER_REDACT_CENSOR },
          autoLogging: false,
        },
      }),
    }),
  ],
})
export class LoggerModule {}
