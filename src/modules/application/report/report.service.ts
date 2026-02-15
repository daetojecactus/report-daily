import { Injectable, Logger } from '@nestjs/common';
import { GitReportService } from './git-report/git-report.service';
import { AiService } from '../ai/ai.service';
import { UserGender, UserRole } from '../user/user.interface';
import { getTaskStatusAction } from './constants/report.messages';
import type { AITaskContext } from '../ai/ai.types';
import type { ReportTaskItem } from './git-report/git-report.interface';
import type { DailyReport, ProjectReport, ReportLine } from './report.types';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly gitReportService: GitReportService,
    private readonly aiService: AiService,
  ) {}

  //генерирует итоговый отчёт за день
  async generateReport(params: {
    gitLabUserId: number;
    username: string;
    userRole: UserRole;
    gender: UserGender;
    date: string;
    useAI?: boolean;
  }): Promise<DailyReport> {
    const {
      gitLabUserId,
      username,
      userRole,
      gender,
      date,
      useAI = true,
    } = params;

    //собираем данные из gitlab: группировка → маппинг → сбор контекста
    const gitReport = await this.gitReportService.generateDailyReport(
      gitLabUserId,
      username,
      userRole,
      date,
    );

    //все задачи в плоский список
    const allTasks = gitReport.projects.flatMap((p) => p.tasks);

    //получаем описания: AI или fallback
    const descriptions = useAI
      ? await this.enhanceWithAI(allTasks, gender)
      : this.buildFallback(allTasks, gender);

    //собираем финальные проекты
    const projects: ProjectReport[] = gitReport.projects.map((project) => ({
      projectName: project.projectName,
      lines: project.tasks.map((task) => ({
        title: task.title,
        status: task.status,
        taskType: task.taskType,
        description:
          descriptions.get(task.taskKey) ??
          `${getTaskStatusAction(task.status, gender)} «${task.title}»`,
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
        taskType: task.taskType,
        labels: task.labels,
        commitMessages: task.aiContext.commitMessages,
        comments: task.aiContext.userComments,
        mrTitle: task.aiContext.mrTitle ?? undefined,
        mrBranch: task.aiContext.mrBranch ?? undefined,
      }));

      return await this.aiService.enhanceTasks({ tasks: contexts, gender });
    } catch (error) {
      this.logger.error('AI failed, using fallback', error);
      return this.buildFallback(tasks, gender);
    }
  }

  //простой fallback — глагол + «название задачи»
  private buildFallback(
    tasks: ReportTaskItem[],
    gender: UserGender,
  ): Map<string, string> {
    const map = new Map<string, string>();
    for (const task of tasks) {
      const verb = getTaskStatusAction(task.status, gender);
      map.set(task.taskKey, `${verb} «${task.title}»`);
    }
    return map;
  }

  //форматирует текстовый отчёт
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
