import { Injectable, Logger } from '@nestjs/common';
import { TaskType } from '../../../common/enums/task.enum';
import { UserGender } from '../user/user.enums';
import type { UserRole } from '../user/user.enums';
import type { AITaskContext, AIEnhanceRequest } from './ai.interface';
import { AiMessages } from './constants/ai.messages';
import { GeminiService } from '../../vendors/gemini/gemini.service';
import { OpenRouterService } from '../../vendors/open-router/open-router.service';
import { GroqService } from '../../vendors/groq/groq.service';
import type { AiProvider } from '../../../common/interfaces/ai-provider.interface';
import { getLocale } from '../../../common/i18n/i18n';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly providers: AiProvider[];

  constructor(
    geminiService: GeminiService,
    openRouterService: OpenRouterService,
    groqService: GroqService,
  ) {
    //приоритет: Gemini, OpenRouter, Groq, fallback
    this.providers = [geminiService, openRouterService, groqService];
  }

  //обогащает задачи через AI, при ошибке пробует следующий провайдер
  async enhanceTasks(request: AIEnhanceRequest): Promise<Map<string, string>> {
    const { tasks, gender, role, language } = request;

    if (tasks.length === 0) {
      return this.fallbackAll(tasks);
    }

    const locale = getLocale(language);
    const prompt = this.buildPrompt(tasks, gender, locale);
    const systemPrompt = this.buildSystemPrompt(role, locale);

    for (const provider of this.providers) {
      try {
        const response = await provider.generate(prompt, systemPrompt);
        this.logger.log(`${AiMessages.AI_GENERATED}: ${provider.name}`);
        return this.parseResponse(response, tasks);
      } catch (error) {
        this.logger.warn(
          `${AiMessages.AI_PROVIDER_FAILED}: ${provider.name}`,
          error,
        );
      }
    }

    this.logger.warn(AiMessages.AI_ALL_PROVIDERS_FAILED);
    return this.fallbackAll(tasks);
  }

  //общий системный промпт + врезка под роль автора: у разработчика, QA и аналитика разный словарь
  private buildSystemPrompt(
    role: UserRole,
    locale: ReturnType<typeof getLocale>,
  ): string {
    const roleHint = locale.ai.roleHints[role];
    return roleHint
      ? `${locale.ai.systemPrompt}\n${roleHint}`
      : locale.ai.systemPrompt;
  }

  //собирает пользовательский промпт из контекстов задач
  private buildPrompt(
    contexts: AITaskContext[],
    gender: UserGender,
    locale: ReturnType<typeof getLocale>,
  ): string {
    const genderHint =
      gender === UserGender.FEMALE
        ? locale.ai.genderFemale
        : locale.ai.genderMale;

    const tasks = contexts
      .map(
        (context, index) =>
          `[${index + 1}] ${this.formatContext(context, locale)}`,
      )
      .join('\n\n---\n\n');

    return `${genderHint}\n\n${contexts.length} ${locale.ai.tasksWord}:\n\n${tasks}\n\n${locale.ai.responseWord} (${contexts.length}):`;
  }

  //форматирует контекст одной задачи для промпта
  private formatContext(
    context: AITaskContext,
    locale: ReturnType<typeof getLocale>,
  ): string {
    const labels = locale.ai.labels;
    const parts = [
      `${labels.task}: «${context.taskTitle}»`,
      `${labels.action}: ${context.actionVerb}`,
    ];

    if (context.taskType !== TaskType.UNKNOWN) {
      parts.push(`${labels.type}: ${context.taskType}`);
    }
    if (context.commitMessages.length > 0) {
      parts.push(`${labels.commits}: ${context.commitMessages.join('; ')}`);
    }
    if (context.comments.length > 0) {
      const truncated = context.comments.map((comment) =>
        comment.length > 150 ? comment.slice(0, 150) + '...' : comment,
      );
      parts.push(`${labels.comments}: ${truncated.join('; ')}`);
    }
    if (context.mrTitle) {
      parts.push(`${labels.mr}: «${context.mrTitle}»`);
    }

    return parts.join('\n');
  }

  //парсит ответ AI сопоставляет строки с задачами
  private parseResponse(
    response: string,
    contexts: AITaskContext[],
  ): Map<string, string> {
    const results = new Map<string, string>();

    const numbered = this.extractNumberedLines(response);

    const fallbackLines =
      numbered.size === 0 ? this.extractCleanLines(response) : [];

    for (let i = 0; i < contexts.length; i++) {
      const text = numbered.get(i + 1) ?? fallbackLines[i];
      results.set(
        contexts[i].taskId,
        text && text.length > 0
          ? text
          : `${contexts[i].actionVerb} «${contexts[i].taskTitle}»`,
      );
    }

    return results;
  }

  //извлекает строки вида «N. текст», игнорируя заголовки/вводные фразы/markdown
  private extractNumberedLines(response: string): Map<number, string> {
    const numbered = new Map<number, string>();

    for (const raw of response.split('\n')) {
      const match = raw.match(/^\s*(\d{1,3})\s*[.):\-]\s+(.*\S.*)$/);
      if (!match) continue;

      const num = parseInt(match[1], 10);
      if (numbered.has(num)) continue;

      const text = this.sanitizeLine(match[2]);
      if (text) numbered.set(num, text);
    }

    return numbered;
  }

  //запасной разбор без нумерации: убираем заголовки/вводные строки
  private extractCleanLines(response: string): string[] {
    return response
      .split('\n')
      .map((line) => this.sanitizeLine(line))
      .filter((line) => line.length > 0 && !this.isNoiseLine(line));
  }

  //строка-мусор: тег [PROJECT] или вводная фраза, заканчивающаяся двоеточием
  private isNoiseLine(line: string): boolean {
    if (/^\[[^\]]+\]$/.test(line)) return true;
    if (line.endsWith(':')) return true;
    return false;
  }

  //убирает markdown-разметку, экранирование и мусорные префиксы из строки
  private sanitizeLine(text: string): string {
    return text
      .replace(/\\([*_`~[\]])/g, '$1') //снимаем экранирование \* \_ \[ ...
      .replace(/[*_`~]+/g, '') //markdown-символы (*, **, _, `, ~)
      .replace(/^>\s*/, '') //цитата
      .replace(/^#+\s*/, '') //markdown-заголовок
      .replace(/^[-•]\s*/, '') //маркер списка
      .replace(/^\[[^\]]+\]\s*/, '') //ведущий тег [PROJECT]
      .replace(/\s+/g, ' ') //схлопываем пробелы
      .trim();
  }

  //статический fallback — глагол + название задачи
  private fallbackAll(contexts: AITaskContext[]): Map<string, string> {
    const results = new Map<string, string>();
    for (const context of contexts) {
      results.set(
        context.taskId,
        `${context.actionVerb} «${context.taskTitle}»`,
      );
    }
    return results;
  }
}
