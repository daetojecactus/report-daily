import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';

if (process.env.TZ) {
  process.env.TZ = process.env.TZ;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
