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
  AI_LIMIT_ATTEMPTS,
  AI_LIMIT_KEY_PREFIX,
  AI_LIMIT_WINDOW_MS,
  AI_LINE_BREAK_PATTERN,
  AI_LINE_MAX_LENGTH,
  AI_MARKUP_PATTERN,
  AI_NAMES_PER_LINE,
  AI_PROMPT_SEPARATOR,
  AI_QUOTE_PATTERN,
  AI_SCHEMA_NAME,
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

  constructor(
    private readonly llmService: LlmService,
    private readonly redisService: RedisService,
    private readonly settingsService: SettingsService,
    configService: ConfigService<AppEnvs, true>,
  ) {
    this.requestsPerMinute = configService.get('LLM_REQUESTS_PER_MINUTE', { infer: true });
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
      const { texts, refused } = this.accept(lines, data.lines);
      this.logger.log(
        { model, lines: lines.length, accepted: texts.size, refused },
        AiMessages.REWORDED,
      );
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

  private accept(lines: AiLine[], answers: { id: string; text: string }[]) {
    const texts = new Map<string, string>();
    const refused: Partial<Record<AiRefusal, number>> = {};
    for (const line of lines) {
      const answer = answers.find(({ id }) => id === line.id)?.text;
      const refusal = this.check(line, answer);
      if (refusal === null && answer !== undefined) {
        texts.set(line.id, this.clean(answer));
      } else {
        const reason = refusal ?? AiRefusal.MISSING;
        refused[reason] = (refused[reason] ?? 0) + 1;
      }
    }
    return { texts, refused };
  }

  private check(line: AiLine, answer: string | undefined): AiRefusal | null {
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
    if (!line.names && this.hasColonAfterAction(line.action, text)) {
      return AiRefusal.COLON;
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

  private hasColonAfterAction(action: string, text: string) {
    const colon = text.indexOf(AI_COLON);
    const quote = text.search(AI_QUOTE_PATTERN);
    return (
      colon !== -1 && colon < action.length + AI_COLON_WINDOW && (quote === -1 || colon < quote)
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
