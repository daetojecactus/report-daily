import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GitReportService } from './git-report/git-report.service';
import { AiService } from '../ai/ai.service';
import { UserGender } from '../user/user.interface';
import type { AITaskContext } from '../ai/ai.types';
import type { ReportTaskItem } from './git-report/git-report.interface';
import type { DailyReport, ProjectReport } from './report.types';
import { UserService } from '../user/user.service';
import { UserMessages } from '../user/constants/user.messages';
import { AiMessages } from '../ai/constants/ai.messages';
import { getReportTaskAction } from 'src/common/helpers/get-report-task-action';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly gitReportService: GitReportService,
    private readonly userService: UserService,
    private readonly aiService: AiService,
  ) {}

  //генерирует итоговый отчет за день
  async generateReport(adminId: string, date: string): Promise<DailyReport> {
    const user = await this.userService.findOne({ adminId });
    if (!user) {
      throw new NotFoundException(UserMessages.USER_NOT_FOUND);
    }

    //собираем данные из gitlab: группировка, маппинг, сбор контекста
    const gitReport = await this.gitReportService.generateDailyReport(
      user.gitLabId,
      user.adminId,
      user.role,
      date,
    );

    //все задачи в плоский список
    const allTasks = gitReport.projects.flatMap((project) => project.tasks);

    //получаем описания: AI или fallback
    const descriptions = user.settings.useAI
      ? await this.enhanceWithAI(allTasks, user.gender)
      : this.buildFallback(allTasks, user.gender);

    //собираем финальные проекты
    const projects: ProjectReport[] = gitReport.projects.map((project) => ({
      projectName: project.projectName,
      lines: project.tasks.map((task) => ({
        title: task.title,
        status: task.status,
        taskType: task.taskType,
        description:
          descriptions.get(task.taskKey) ??
          `${getReportTaskAction(task.status, user.gender)} «${task.title}»`,
      })),
    }));

    return {
      date,
      projects,
      text: this.formatText(projects),
    };
  }

  //пробует AI, при ошибке — fallback
  private async enhanceWithAI(
    tasks: ReportTaskItem[],
    gender: UserGender,
  ): Promise<Map<string, string>> {
    if (tasks.length === 0) {
      return this.buildFallback(tasks, gender);
    }

    try {
      const contexts: AITaskContext[] = tasks.map((task) => ({
        taskId: task.taskKey,
        taskTitle: task.title,
        status: task.status,
        actionVerb: getReportTaskAction(task.status, gender),
        taskType: task.taskType,
        commitMessages: task.aiContext.commitMessages,
        comments: task.aiContext.userComments,
        mrTitle: task.aiContext.mrTitle ?? undefined,
      }));

      return await this.aiService.enhanceTasks({ tasks: contexts, gender });
    } catch (error) {
      this.logger.error(AiMessages.AI_FALLBACK, error);
      return this.buildFallback(tasks, gender);
    }
  }

  //простой fallback действие + «название задачи»
  private buildFallback(
    tasks: ReportTaskItem[],
    gender: UserGender,
  ): Map<string, string> {
    const map = new Map<string, string>();
    for (const task of tasks) {
      const verb = getReportTaskAction(task.status, gender);
      map.set(task.taskKey, `${verb} «${task.title}»`);
    }
    return map;
  }

  //форматирует текстовый отчет
  //project:\n• description\n\nproject2:\n• description
  private formatText(projects: ProjectReport[]): string {
    return projects
      .map((project) => {
        const lines = project.lines
          .map((line) => `• ${line.description}`)
          .join('\n');
        return `${project.projectName}:\n${lines}`;
      })
      .join('\n\n');
  }
}
