import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { toDate } from './common/utils/date.util';
import { PreviewMessages } from './modules/preview/constants/preview.messages';
import { PreviewModule } from './modules/preview/preview.module';
import { PreviewRecorder } from './modules/preview/preview.recorder';

const [directory = '', ...dateTexts] = process.argv.slice(2);
const dates = dateTexts.map((text) => toDate(text)).filter((date) => date !== null);
if (!directory || dates.length === 0 || dates.length !== dateTexts.length) {
  Logger.error(PreviewMessages.GOLDEN_USAGE);
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(PreviewModule, {
  logger: ['error', 'warn'],
});
try {
  const files = await app.get(PreviewRecorder).record(dates);
  await mkdir(directory, { recursive: true });
  for (const { name, fixture } of files) {
    await writeFile(join(directory, name), `${JSON.stringify(fixture, null, 2)}\n`);
  }
  process.stdout.write(`${PreviewMessages.GOLDEN_WRITTEN}: ${files.length}\n`);
} catch (error) {
  Logger.error(PreviewMessages.GOLDEN_FAILED, error);
  process.exitCode = 1;
} finally {
  await app.close();
}
