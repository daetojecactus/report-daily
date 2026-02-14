import { Injectable, Logger } from '@nestjs/common';
import { TaskStatus, TaskType } from '../../../common/enums/task.enum';
import { UserGender } from '../user/user.interface';
import type { AITaskContext, AIEnhanceRequest } from './ai.types';
import { AI_SYSTEM_PROMPT } from './constants/ai.prompt';
import { getTaskStatusAction } from '../report/constants/report.messages';
import { GroqService } from '../../vendors/groq/groq.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  constructor(private readonly groqService: GroqService) {}

  isEnabled(): boolean {
    return this.groqService.isEnabled();
  }

  //обогащает задачи через AI, возвращает map taskId → описание
  async enhanceTasks(request: AIEnhanceRequest): Promise<Map<string, string>> {
    const { tasks, gender } = request;

    if (!this.isEnabled() || tasks.length === 0) {
      return this.fallbackAll(tasks, gender);
    }

    try {
      const prompt = this.buildPrompt(tasks, gender);
      const response = await this.groqService.generate(prompt);
      return this.parseResponse(response, tasks, gender);
    } catch (error) {
      this.logger.error('AI enhancement failed', error);
      return this.fallbackAll(tasks, gender);
    }
  }

  //формирует fallback без AI — просто глагол + название задачи
  formatFallback(
    status: TaskStatus,
    title: string,
    gender: UserGender,
  ): string {
    const verb = getTaskStatusAction(status, gender);
    return `${verb} «${title}»`;
  }

  private buildPrompt(contexts: AITaskContext[], gender: UserGender): string {
    const genderHint =
      gender === UserGender.FEMALE
        ? 'Пиши от лица ДЕВУШКИ (женский род): "Продолжила", "Добавила", "Исправила"'
        : 'Пиши от лица МУЖЧИНЫ (мужской род): "Продолжил", "Добавил", "Исправил"';

    const tasks = contexts
      .map((ctx, i) => `[${i + 1}] ${this.formatContext(ctx)}`)
      .join('\n\n---\n\n');

    return `${AI_SYSTEM_PROMPT}

${genderHint}

${contexts.length} задач. Для каждой напиши ОДНУ строку (начинай с глагола!).

${tasks}

Ответ (строго ${contexts.length} пунктов, по одной строке):
1.`;
  }

  private formatContext(context: AITaskContext): string {
    const parts = [
      `Задача: "${context.taskTitle}"`,
      `Статус: ${context.status}`,
    ];

    if (context.taskType !== TaskType.UNKNOWN) {
      parts.push(`Тип: ${context.taskType}`);
    }
    if (context.commitMessages.length > 0) {
      parts.push(`Коммиты: ${context.commitMessages.join('; ')}`);
    }
    if (context.comments.length > 0) {
      const truncated = context.comments.map((comment) =>
        comment.length > 100 ? comment.slice(0, 100) + '...' : comment,
      );
      parts.push(`Комментарии: ${truncated.join('; ')}`);
    }
    if (context.mrTitle) {
      parts.push(`МР: "${context.mrTitle}"`);
    }

    return parts.join('\n');
  }

  private parseResponse(
    response: string,
    contexts: AITaskContext[],
    gender: UserGender,
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
          this.formatFallback(
            contexts[i].status,
            contexts[i].taskTitle,
            gender,
          ),
        );
      }
    }

    return results;
  }

  private fallbackAll(
    contexts: AITaskContext[],
    gender: UserGender,
  ): Map<string, string> {
    const results = new Map<string, string>();
    for (const context of contexts) {
      results.set(
        context.taskId,
        this.formatFallback(context.status, context.taskTitle, gender),
      );
    }
    return results;
  }
}
