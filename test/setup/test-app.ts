import type { DynamicModule, Type } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from 'src/modules/app.module';
import { CleanupTask } from 'src/modules/tasks/cleanup/cleanup.task';
import { ScheduleTask } from 'src/modules/tasks/schedule/schedule.task';

export async function createTestApp(
  imports: (Type<unknown> | DynamicModule)[] = [],
): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...imports],
  })
    .overrideProvider(ScheduleTask)
    .useValue({})
    .overrideProvider(CleanupTask)
    .useValue({})
    .compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: false,
  });

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
