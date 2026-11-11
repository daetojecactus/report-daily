import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppMessages } from './common/constants/app.messages';
import { AppModule } from './modules/app.module';
import { APP_HOST } from './modules/infrastructure/config/constants/config.constants';
import type { AppEnvs } from './modules/infrastructure/config/config.env';

try {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
    abortOnError: false,
  });
  const logger = app.get(PinoLogger);
  app.useLogger(logger);
  app.enableShutdownHooks();

  const port = app.get<ConfigService<AppEnvs, true>>(ConfigService).get('PORT', { infer: true });
  await app.listen({ host: APP_HOST, port });
  logger.log({ host: APP_HOST, port }, AppMessages.APP_LISTENING);
} catch (error) {
  Logger.error(AppMessages.APP_INIT_ERROR, error);
  process.exit(1);
}
