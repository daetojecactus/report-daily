import type { DynamicModule, Type } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from 'src/modules/app.module';
import { SystemTask } from 'src/modules/tasks/system/system.task';

export async function createTestApp(
  imports: (Type<unknown> | DynamicModule)[] = [],
): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...imports],
  })
    .overrideProvider(SystemTask)
    .useValue({ onApplicationBootstrap: () => undefined })
    .compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: false,
  });

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
