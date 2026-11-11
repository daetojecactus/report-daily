import { z } from 'zod';
import { BotNamespace } from '../../../core/types/bot.enums';
import { BroadcastAction, BroadcastStep } from '../types/broadcast.enums';

export const BROADCAST_TEXT_MAX_LENGTH = 4000;

export const BROADCAST_BUTTON_SCHEMA = z
  .tuple([z.literal(BotNamespace.BROADCAST), z.enum(BroadcastAction)])
  .transform(([, action]) => ({ action }));

export const BROADCAST_DRAFT_SCHEMA = z.object({
  text: z.string().min(1).max(BROADCAST_TEXT_MAX_LENGTH),
});

export const BROADCAST_TEXT_STEPS: string[] = [BroadcastStep.TEXT, BroadcastStep.PREVIEW];
