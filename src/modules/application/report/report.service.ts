import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GitReportService } from './git-report/git-report.service';
import { ReportTemplateService } from './report-template/report-template.service';
import { AiService } from '../ai/ai.service';
import type { AITaskContext } from '../ai/ai.interface';
import type { ReportTaskItem } from './git-report/git-report.interface';
import type { DailyReport, ProjectReport } from './report.interface';
import { UserService } from '../user/user.service';
import { UserMessages } from '../user/constants/user.messages';
import { AiMessages } from '../ai/constants/ai.messages';
import { getReportTaskAction } from 'src/common/helpers/get-report-task-action.helper';
import { Language } from 'src/common/i18n/i18n';
import { resolveUserLanguage } from '../user/user.helper';
import { ReportTemplate, UserGender } from '../user/user.enums';
import type { User } from '../user/user.schema';
import { ConfigService } from '@nestjs/config';
import type { ReportDailyBotEnvs } from 'src/modules/infrastructure/config/env';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly gitReportService: GitReportService,
    private readonly reportTemplateService: ReportTemplateService,
    private readonly userService: UserService,
    private readonly aiService: AiService,
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {}

  //генерирует итоговый отчет за день
  async generateReport(adminId: string, date: string): Promise<DailyReport> {
    const user = await this.userService.findOne({ adminId });
    if (!user) {
      throw new NotFoundException(UserMessages.USER_NOT_FOUND);
    }

    const language = resolveUserLanguage(user);

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
      ? await this.enhanceWithAI(allTasks, user, language)
      : this.buildFallback(allTasks, user.gender, language);

    //собираем финальные проекты
    const projects: ProjectReport[] = gitReport.projects.map((project) => ({
      projectName: project.projectName,
      lines: project.tasks.map((task) => ({
        title: task.title,
        status: task.status,
        taskType: task.taskType,
        description:
          descriptions.get(task.taskKey) ??
          `${getReportTaskAction(task.status, user.gender, language)} «${task.title}»`,
        webUrl: task.webUrl,
        priority: task.priority,
      })),
    }));

    const template = user.settings.reportTemplate ?? ReportTemplate.STANDARD;
    const gitlabUrl = this.configService.get('GITLAB_URL', { infer: true });

    return {
      date,
      projects,
      text: this.reportTemplateService.formatText(
        projects,
        template,
        language,
        gitlabUrl,
      ),
    };
  }

  //пробует AI, при ошибке — fallback
  private async enhanceWithAI(
    tasks: ReportTaskItem[],
    user: Pick<User, 'gender' | 'role'>,
    language: Language,
  ): Promise<Map<string, string>> {
    const { gender, role } = user;

    if (tasks.length === 0) {
      return this.buildFallback(tasks, gender, language);
    }

    try {
      const contexts: AITaskContext[] = tasks.map((task) => ({
        taskId: task.taskKey,
        taskTitle: task.title,
        status: task.status,
        actionVerb: getReportTaskAction(task.status, gender, language),
        taskType: task.taskType,
        commitMessages: task.aiContext.commitMessages,
        comments: task.aiContext.userComments,
        mrTitle: task.aiContext.mrTitle ?? undefined,
      }));

      return await this.aiService.enhanceTasks({
        tasks: contexts,
        gender,
        role,
        language,
      });
    } catch (error) {
      this.logger.error(AiMessages.AI_FALLBACK, error);
      return this.buildFallback(tasks, gender, language);
    }
  }

  //простой fallback действие + «название задачи»
  private buildFallback(
    tasks: ReportTaskItem[],
    gender: UserGender,
    language: Language,
  ): Map<string, string> {
    const map = new Map<string, string>();
    for (const task of tasks) {
      const verb = getReportTaskAction(task.status, gender, language);
      map.set(task.taskKey, `${verb} «${task.title}»`);
    }
    return map;
  }
}
