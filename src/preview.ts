import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { toDate } from './common/utils/date.util';
import { PreviewMessages } from './modules/preview/constants/preview.messages';
import { PreviewModule } from './modules/preview/preview.module';
import { PreviewService } from './modules/preview/preview.service';

const [username = '', dateText = ''] = process.argv.slice(2);
const date = toDate(dateText);
if (!username || !date) {
  Logger.error(PreviewMessages.USAGE);
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(PreviewModule, {
  logger: ['error', 'warn'],
});
try {
  const text = await app.get(PreviewService).describe(username, date);
  if (text === null) {
    Logger.error(`${PreviewMessages.EMPLOYEE_NOT_FOUND}: ${username}`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`${text}\n`);
  }
} catch (error) {
  Logger.error(PreviewMessages.FAILED, error);
  process.exitCode = 1;
} finally {
  await app.close();
}
