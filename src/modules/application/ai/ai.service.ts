import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from 'src/common/utils/error.util';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import type { LlmPrompt } from 'src/modules/vendors/llm/llm.interface';
import { LlmService } from 'src/modules/vendors/llm/llm.service';
import {
  AI_ANSWER_SCHEMA,
  AI_DATA_END,
  AI_DATA_ESCAPES,
  AI_DATA_START,
  AI_ERROR_MAX_LENGTH,
  AI_ESCAPED_MARKUP_PATTERN,
  AI_LEAD_PATTERN,
  AI_LIMIT_ATTEMPTS,
  AI_LIMIT_KEY_PREFIX,
  AI_LIMIT_WINDOW_MS,
  AI_LINE_BREAK_PATTERN,
  AI_LINE_MAX_LENGTH,
  AI_MARKUP_PATTERN,
  AI_PROMPT_SEPARATOR,
  AI_REQUESTS_PER_MINUTE,
  AI_SCHEMA_NAME,
  AI_SPACES_PATTERN,
} from './constants/ai.constants';
import { AiMessages } from './constants/ai.messages';
import type { AiLine, AiProfile, AiRewording } from './ai.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly redisService: RedisService,
  ) {}

  isEnabled() {
    return this.llmService.isEnabled();
  }

  async reword(lines: AiLine[], profile: AiProfile): Promise<AiRewording> {
    const kept: AiRewording = { texts: new Map(), model: null };
    if (lines.length === 0 || !this.isEnabled()) {
      return kept;
    }
    try {
      if (!(await this.takeSlot())) {
        this.logger.warn({ lines: lines.length }, AiMessages.RATE_LIMITED);
        return kept;
      }
      const { data, model } = await this.llmService.completeJson({
        prompt: this.toPrompt(lines, profile),
        name: AI_SCHEMA_NAME,
        schema: AI_ANSWER_SCHEMA,
      });
      const texts = this.accept(lines, data.lines);
      this.logger.log({ model, lines: lines.length, accepted: texts.size }, AiMessages.REWORDED);
      return { texts, model: texts.size > 0 ? model : null };
    } catch (error) {
      this.logger.warn(
        { lines: lines.length, error: getErrorMessage(error).slice(0, AI_ERROR_MAX_LENGTH) },
        AiMessages.FAILED,
      );
      return kept;
    }
  }

  private async takeSlot() {
    for (let attempt = 1; attempt <= AI_LIMIT_ATTEMPTS; attempt++) {
      const now = Date.now();
      const window = Math.floor(now / AI_LIMIT_WINDOW_MS);
      const count = await this.redisService.increment(
        `${AI_LIMIT_KEY_PREFIX}${window}`,
        AI_LIMIT_WINDOW_MS,
      );
      if (count <= AI_REQUESTS_PER_MINUTE) {
        return true;
      }
      if (attempt < AI_LIMIT_ATTEMPTS) {
        await new Promise((resolve) =>
          setTimeout(resolve, (window + 1) * AI_LIMIT_WINDOW_MS - now),
        );
      }
    }
    return false;
  }

  private toPrompt(lines: AiLine[], { role, gender, locale }: AiProfile): LlmPrompt {
    const data = JSON.stringify({
      lines: lines.map(({ id, action, title, kind }) => ({
        id,
        action,
        title,
        ...(kind ? { type: kind } : {}),
      })),
    });
    return {
      system: [locale.ai.system, locale.ai.roles[role], locale.ai.genders[gender]].join(
        AI_PROMPT_SEPARATOR,
      ),
      user: [
        locale.ai.request(lines.length),
        AI_DATA_START,
        AI_DATA_ESCAPES.reduce((text, [pattern, escape]) => text.replace(pattern, escape), data),
        AI_DATA_END,
      ].join('\n'),
    };
  }

  private accept(lines: AiLine[], answers: { id: string; text: string }[]) {
    const texts = new Map<string, string>();
    for (const line of lines) {
      const answer = answers.find(({ id }) => id === line.id);
      if (!answer || AI_LINE_BREAK_PATTERN.test(answer.text.trim())) {
        continue;
      }
      const text = this.clean(answer.text);
      if (
        text.length > line.action.length &&
        text.length <= AI_LINE_MAX_LENGTH &&
        text.toLowerCase().startsWith(line.action.toLowerCase())
      ) {
        texts.set(line.id, text);
      }
    }
    return texts;
  }

  private clean(text: string) {
    return text
      .replace(AI_ESCAPED_MARKUP_PATTERN, '$1')
      .replace(AI_MARKUP_PATTERN, '')
      .replace(AI_LEAD_PATTERN, '')
      .replace(AI_SPACES_PATTERN, ' ')
      .trim();
  }
}
