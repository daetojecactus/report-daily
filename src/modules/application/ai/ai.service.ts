import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { getErrorMessage } from 'src/common/utils/error.util';
import { SettingsService } from 'src/modules/application/settings/settings.service';
import type { User } from 'src/modules/application/user/types/user.interface';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import type { LlmPrompt } from 'src/modules/vendors/llm/types/llm.interface';
import { LlmService } from 'src/modules/vendors/llm/llm.service';
import {
  AI_ANSWER_BASE_TOKENS,
  AI_ANSWER_LINE_TOKENS,
  AI_ANSWER_SCHEMA,
  AI_COLON,
  AI_COLON_WINDOW,
  AI_COMMENTS_PER_LINE,
  AI_COMMENT_MAX_LENGTH,
  AI_COMMITS_PER_LINE,
  AI_CUT_MARK,
  AI_DATA_END,
  AI_DATA_ESCAPES,
  AI_DATA_START,
  AI_ERROR_MAX_LENGTH,
  AI_ESCAPED_MARKUP_PATTERN,
  AI_FINAL_PERIOD_PATTERN,
  AI_LEAD_PATTERN,
  AI_DAILY_LIMIT_KEY_PREFIX,
  AI_DAY_MS,
  AI_LIMIT_ATTEMPTS,
  AI_LIMIT_KEY_PREFIX,
  AI_LIMIT_WINDOW_MS,
  AI_LINE_BREAK_PATTERN,
  AI_LINE_MAX_LENGTH,
  AI_LINES_PER_REQUEST,
  AI_LINK_PATTERN,
  AI_MARKUP_PATTERN,
  AI_NAMES_ACTION_MAX_LENGTH,
  AI_NAMES_PER_LINE,
  AI_PROMPT_SEPARATOR,
  AI_QUOTE_PATTERN,
  AI_SCHEMA_NAME,
  AI_SLANG_PATTERNS,
  AI_SPACES_PATTERN,
  AI_STEM_CUT,
  AI_STEM_MIN_WORD,
  AI_WORD_PATTERN,
} from './constants/ai.constants';
import { AiRefusal } from './types/ai.enums';
import { AiMessages } from './constants/ai.messages';
import type { AiLine, AiNames, AiPolicy, AiProfile, AiRewording } from './types/ai.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private readonly requestsPerMinute: number;

  private readonly requestsPerEmployeePerDay: number;

  constructor(
    private readonly llmService: LlmService,
    private readonly redisService: RedisService,
    private readonly settingsService: SettingsService,
    configService: ConfigService<AppEnvs, true>,
  ) {
    this.requestsPerMinute = configService.get('LLM_REQUESTS_PER_MINUTE', { infer: true });
    this.requestsPerEmployeePerDay = configService.get('LLM_REQUESTS_PER_EMPLOYEE_PER_DAY', {
      infer: true,
    });
  }

  isEnabled() {
    return this.llmService.isEnabled();
  }

  async findPolicy(user: User): Promise<AiPolicy | null> {
    if (!this.isEnabled() || !user.aiEnabled) {
      return null;
    }
    const settings = await this.settingsService.findAi();
    if (!settings.aiEnabled) {
      return null;
    }
    return {
      commits: settings.aiSendCommits && !user.aiDataOptOut,
      comments: settings.aiSendComments && !user.aiDataOptOut,
    };
  }

  async reword(lines: AiLine[], profile: AiProfile): Promise<AiRewording> {
    const rewording: AiRewording = { texts: new Map(), model: null };
    if (lines.length === 0 || !this.isEnabled()) {
      return rewording;
    }
    try {
      if (!(await this.takeDailySlot(profile.userId))) {
        this.logger.warn(
          { userId: profile.userId, limit: this.requestsPerEmployeePerDay },
          AiMessages.DAILY_LIMITED,
        );
        return rewording;
      }
      for (const part of this.toParts(lines)) {
        if (!(await this.takeSlot())) {
          this.logger.warn({ lines: part.length }, AiMessages.RATE_LIMITED);
          return rewording;
        }
        const maxTokens = AI_ANSWER_BASE_TOKENS + part.length * AI_ANSWER_LINE_TOKENS;
        const { data, model, usage } = await this.llmService.completeJson({
          prompt: this.toPrompt(part, profile),
          name: AI_SCHEMA_NAME,
          schema: AI_ANSWER_SCHEMA,
          maxTokens,
        });
        const { texts, refused } = this.accept(
          part,
          data.lines,
          AI_SLANG_PATTERNS[profile.language] ?? null,
        );
        this.logger.log(
          {
            model,
            lines: part.length,
            accepted: texts.size,
            refused,
            ...usage,
            maxTokens,
          },
          AiMessages.REWORDED,
        );
        texts.forEach((text, id) => rewording.texts.set(id, text));
        if (texts.size > 0) {
          rewording.model = model;
        }
      }
    } catch (error) {
      this.logger.warn(
        { lines: lines.length, error: getErrorMessage(error).slice(0, AI_ERROR_MAX_LENGTH) },
        AiMessages.FAILED,
      );
    }
    return rewording;
  }

  private toParts(lines: AiLine[]) {
    const count = Math.ceil(lines.length / AI_LINES_PER_REQUEST);
    const size = Math.ceil(lines.length / count);
    return Array.from({ length: count }, (_, index) =>
      lines.slice(index * size, (index + 1) * size),
    );
  }

  private async takeDailySlot(userId: string) {
    const day = Math.floor(Date.now() / AI_DAY_MS);
    const count = await this.redisService.increment(
      `${AI_DAILY_LIMIT_KEY_PREFIX}${userId}:${day}`,
      AI_DAY_MS,
    );
    return count <= this.requestsPerEmployeePerDay;
  }

  private async takeSlot() {
    for (let attempt = 1; attempt <= AI_LIMIT_ATTEMPTS; attempt++) {
      const now = Date.now();
      const window = Math.floor(now / AI_LIMIT_WINDOW_MS);
      const count = await this.redisService.increment(
        `${AI_LIMIT_KEY_PREFIX}${window}`,
        AI_LIMIT_WINDOW_MS,
      );
      if (count <= this.requestsPerMinute) {
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
      lines: lines.map(({ id, action, title, kind, commits, comments, names }) => ({
        id,
        action,
        title,
        ...(kind ? { type: kind } : {}),
        ...(commits.length ? { commits: commits.slice(0, AI_COMMITS_PER_LINE) } : {}),
        ...(comments.length
          ? {
              comments: comments.slice(0, AI_COMMENTS_PER_LINE).map((comment) => this.cut(comment)),
            }
          : {}),
        ...(names ? { names: this.toNames(names) } : {}),
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

  private accept(lines: AiLine[], answers: { id: string; text: string }[], slang: RegExp | null) {
    const texts = new Map<string, string>();
    const refused: Partial<Record<AiRefusal, number>> = {};
    for (const line of lines) {
      const answer = answers.find(({ id }) => id === line.id)?.text;
      const refusal = this.check(line, answer, slang);
      if (refusal === null && answer !== undefined) {
        texts.set(line.id, this.clean(answer));
      } else {
        const reason = refusal ?? AiRefusal.MISSING;
        refused[reason] = (refused[reason] ?? 0) + 1;
      }
    }
    return { texts, refused };
  }

  private check(line: AiLine, answer: string | undefined, slang: RegExp | null): AiRefusal | null {
    if (answer === undefined) {
      return AiRefusal.MISSING;
    }
    if (AI_LINE_BREAK_PATTERN.test(answer.trim())) {
      return AiRefusal.BROKEN;
    }
    const text = this.clean(answer);
    if (text.length > AI_LINE_MAX_LENGTH) {
      return AiRefusal.TOO_LONG;
    }
    if (!this.keepsMeaning(line, text.toLowerCase())) {
      return AiRefusal.CHANGED;
    }
    if (
      this.hasColonAfterAction(line.names ? AI_NAMES_ACTION_MAX_LENGTH : line.action.length, text)
    ) {
      return AiRefusal.COLON;
    }
    if (AI_LINK_PATTERN.test(text) && !AI_LINK_PATTERN.test(line.title)) {
      return AiRefusal.LINK;
    }
    if (slang?.test(text)) {
      return AiRefusal.SLANG;
    }
    return null;
  }

  private keepsMeaning({ action, names }: AiLine, text: string) {
    const phrase = action.toLowerCase();
    if (text.length === 0 || text === phrase) {
      return false;
    }
    if (names) {
      return true;
    }
    return this.toStems(phrase).every((stem) => text.includes(stem));
  }

  private toStems(phrase: string) {
    return (phrase.match(AI_WORD_PATTERN) ?? [])
      .filter((word) => word.length >= AI_STEM_MIN_WORD)
      .map((word) => word.slice(0, Math.max(AI_STEM_MIN_WORD, word.length - AI_STEM_CUT)));
  }

  private hasColonAfterAction(actionLength: number, text: string) {
    const colon = text.indexOf(AI_COLON);
    const quote = text.search(AI_QUOTE_PATTERN);
    return (
      colon !== -1 && colon < actionLength + AI_COLON_WINDOW && (quote === -1 || colon < quote)
    );
  }

  private toNames({ added, removed }: AiNames) {
    return {
      ...(added.length ? { added: added.slice(0, AI_NAMES_PER_LINE) } : {}),
      ...(removed.length ? { removed: removed.slice(0, AI_NAMES_PER_LINE) } : {}),
    };
  }

  private cut(comment: string) {
    const text = comment.replace(AI_SPACES_PATTERN, ' ').trim();
    return text.length > AI_COMMENT_MAX_LENGTH
      ? `${text.slice(0, AI_COMMENT_MAX_LENGTH)}${AI_CUT_MARK}`
      : text;
  }

  private clean(text: string) {
    return text
      .replace(AI_ESCAPED_MARKUP_PATTERN, '$1')
      .replace(AI_MARKUP_PATTERN, '')
      .replace(AI_LEAD_PATTERN, '')
      .replace(AI_SPACES_PATTERN, ' ')
      .trim()
      .replace(AI_FINAL_PERIOD_PATTERN, '');
  }
}
