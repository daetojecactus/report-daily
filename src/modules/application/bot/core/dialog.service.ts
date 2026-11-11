import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import {
  BOT_DIALOG_KEY_PREFIX,
  BOT_DIALOG_SCHEMA,
  BOT_DIALOG_TTL_MS,
  BOT_KEY_SEPARATOR,
} from './constants/bot.constants';
import type { BotNamespace } from './types/bot.enums';
import type { BotActor, BotDialog } from './types/bot.interface';

@Injectable()
export class DialogService {
  constructor(private readonly redisService: RedisService) {}

  async find(actor: BotActor): Promise<BotDialog | null> {
    const value = await this.redisService.get(this.getKey(actor));
    if (value === null) {
      return null;
    }
    const parsed = BOT_DIALOG_SCHEMA.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  }

  save(actor: BotActor, dialog: BotDialog) {
    return this.redisService.set(this.getKey(actor), JSON.stringify(dialog), BOT_DIALOG_TTL_MS);
  }

  delete(actor: BotActor) {
    return this.redisService.delete(this.getKey(actor));
  }

  readDraft<T>(
    dialog: BotDialog | null,
    namespace: BotNamespace,
    schema: z.ZodType<T>,
    ...steps: string[]
  ): T | null {
    if (dialog?.namespace !== namespace || !steps.includes(dialog.step)) {
      return null;
    }
    const draft = schema.safeParse(dialog.data);
    return draft.success ? draft.data : null;
  }

  private getKey(actor: BotActor) {
    return [BOT_DIALOG_KEY_PREFIX, actor.channel, actor.externalId].join(BOT_KEY_SEPARATOR);
  }
}
