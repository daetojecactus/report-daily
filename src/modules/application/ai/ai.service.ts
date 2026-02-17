import { Injectable, Logger } from '@nestjs/common';
import { TaskType } from '../../../common/enums/task.enum';
import { UserGender } from '../user/user.interface';
import type { AITaskContext, AIEnhanceRequest } from './ai.types';
import { AI_SYSTEM_PROMPT, AiPromptTemplate } from './constants/ai.prompt';
import { AiMessages } from './constants/ai.messages';
import { OpenRouterService } from '../../vendors/open-router/open-router.service';
import { GroqService } from '../../vendors/groq/groq.service';
import type { AiProvider } from '../../../common/interfaces/ai-provider.interface';
import { AiPromptLabels } from '../../../common/constants/defautl.messages';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly providers: AiProvider[];

  constructor(openRouterService: OpenRouterService, groqService: GroqService) {
    //приоритет: OpenRouter, Groq, fallback
    this.providers = [openRouterService, groqService];
  }

  //обогащает задачи через AI, при ошибке пробует следующий провайдер
  async enhanceTasks(request: AIEnhanceRequest): Promise<Map<string, string>> {
    const { tasks, gender } = request;

    if (tasks.length === 0) {
      return this.fallbackAll(tasks);
    }

    const prompt = this.buildPrompt(tasks, gender);

    for (const provider of this.providers) {
      try {
        const response = await provider.generate(prompt, AI_SYSTEM_PROMPT);
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

  //собирает пользовательский промпт из контекстов задач
  private buildPrompt(contexts: AITaskContext[], gender: UserGender): string {
    const genderHint =
      gender === UserGender.FEMALE
        ? AiPromptTemplate.GENDER_FEMALE
        : AiPromptTemplate.GENDER_MALE;

    const tasks = contexts
      .map((context, index) => `[${index + 1}] ${this.formatContext(context)}`)
      .join('\n\n---\n\n');

    return `${genderHint}\n\n${contexts.length} задач:\n\n${tasks}\n\nОтвет (${contexts.length} строк):\n1.`;
  }

  //форматирует контекст одной задачи для промпта
  private formatContext(context: AITaskContext): string {
    const parts = [
      `${AiPromptLabels.TASK}: «${context.taskTitle}»`,
      `${AiPromptLabels.ACTION}: ${context.actionVerb}`,
    ];

    if (context.taskType !== TaskType.UNKNOWN) {
      parts.push(`${AiPromptLabels.TYPE}: ${context.taskType}`);
    }
    if (context.commitMessages.length > 0) {
      parts.push(
        `${AiPromptLabels.COMMITS}: ${context.commitMessages.join('; ')}`,
      );
    }
    if (context.comments.length > 0) {
      const truncated = context.comments.map((comment) =>
        comment.length > 150 ? comment.slice(0, 150) + '...' : comment,
      );
      parts.push(`${AiPromptLabels.COMMENTS}: ${truncated.join('; ')}`);
    }
    if (context.mrTitle) {
      parts.push(`${AiPromptLabels.MR}: «${context.mrTitle}»`);
    }

    return parts.join('\n');
  }

  //парсит ответ AI — сопоставляет строки с задачами
  private parseResponse(
    response: string,
    contexts: AITaskContext[],
  ): Map<string, string> {
    const results = new Map<string, string>();
    const lines = response.split('\n').filter((line) => line.trim());

    for (let i = 0; i < contexts.length; i++) {
      const line = lines[i];
      if (line) {
        const cleaned = line
          .replace(/^[\d]+[.):\s]+/, '')
          .replace(/^[-•*]\s*/, '')
          .trim();
        results.set(contexts[i].taskId, cleaned);
      } else {
        results.set(
          contexts[i].taskId,
          `${contexts[i].actionVerb} «${contexts[i].taskTitle}»`,
        );
      }
    }

    return results;
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
