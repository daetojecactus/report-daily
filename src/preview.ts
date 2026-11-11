import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { toDate } from './common/utils/date.util';
import { Language } from './modules/application/i18n/types/i18n.enums';
import {
  PREVIEW_AI_FLAG,
  PREVIEW_LANGUAGE_FLAG,
  PREVIEW_TRACE_FLAG,
} from './modules/preview/constants/preview.constants';
import { PreviewMessages } from './modules/preview/constants/preview.messages';
import { PreviewModule } from './modules/preview/preview.module';
import { PreviewService } from './modules/preview/preview.service';

const [username = '', dateText = '', ...flags] = process.argv.slice(2);
const date = toDate(dateText);
const languageFlag = flags.find((flag) => flag.startsWith(PREVIEW_LANGUAGE_FLAG));
const language =
  Object.values(Language).find((value) => languageFlag === `${PREVIEW_LANGUAGE_FLAG}${value}`) ??
  null;
const knownFlags = [PREVIEW_TRACE_FLAG, PREVIEW_AI_FLAG, languageFlag];
const hasUnknownFlag = flags.some((flag) => !knownFlags.includes(flag));
if (!username || !date || (languageFlag && !language) || hasUnknownFlag) {
  Logger.error(PreviewMessages.USAGE);
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(PreviewModule, {
  logger: ['error', 'warn'],
});
try {
  const text = await app.get(PreviewService).describe(username, date, {
    trace: flags.includes(PREVIEW_TRACE_FLAG),
    language,
    ai: flags.includes(PREVIEW_AI_FLAG),
  });
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
