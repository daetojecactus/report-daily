import { z } from 'zod';
import { BotCommand } from '../types/bot.enums';

export const BOT_CHANNELS = Symbol('BOT_CHANNELS');

export const BOT_KEY_SEPARATOR = ':';

export const BOT_DIALOG_KEY_PREFIX = 'dialog';

export const BOT_DIALOG_TTL_MS = 30 * 60 * 1000;

export const BOT_DIALOG_SCHEMA = z.object({
  namespace: z.string(),
  step: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const BOT_COMMAND_SCHEMA = z.enum(BotCommand);

export const BOT_BUTTON_DATA_SEPARATOR = ':';

export const BOT_BUTTON_DATA_SCHEMA = z
  .string()
  .max(64)
  .regex(/^[a-z][a-z0-9-]*(:[A-Za-z0-9_.-]*)*$/);
