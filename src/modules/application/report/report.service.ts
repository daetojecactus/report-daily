import { Injectable, Logger } from '@nestjs/common';
import { GitService } from '../git/git.service';
import { AiService } from '../ai/ai.service';
import { TaskStatusService } from './task-status.service';
import { TelegramService } from '../../vendors/telegram/telegram.service';
import { ReportMessage } from './constants/report.messages';
import type { GitLabEvent } from '../../vendors/gitlab/gitlab.types';
import type { AITaskContext } from '../ai/ai.types';
import type { MRInfo, AIContext } from '../git/git.types';
import type {
  DailyReport,
  ProjectReport,
  TaskGroup,
  TaskActionInfo,
  TaskInfo,
} from './report.types';
import type { ReportGenerateDto } from '../../api/report/dto/report-generate.dto';
import type { ReportGenerateResponse } from '../../api/report/responses/report-generate.response';
import { TaskAction, TaskStatus } from '../../../common/enums/task.enum';
import { GitLabIssueState } from '../../../common/enums/gitlab.enum';
import { LabelType, LabelPriority } from '../../../common/enums/label.enum';
import { getTargetDate } from '../../../utils/get-target-date.util';
import { FormatterService } from './formatter/formatter.service';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly gitService: GitService,
    private readonly aiService: AiService,
    private readonly taskStatusService: TaskStatusService,
    private readonly formatterService: FormatterService,
    private readonly telegramService: TelegramService,
  ) {}

  async generateReport(
    params: ReportGenerateDto,
  ): Promise<ReportGenerateResponse> {
    const targetDate = getTargetDate(params.date);

    const report = await this.generate(targetDate, params.skipAi);

    if (!params.skipTelegram && this.telegramService.isConfigured()) {
      const telegramText = this.formatterService.formatTelegram(report);
      await this.telegramService.sendMessage(telegramText);
    }

    return {
      date: targetDate.toISOString().split('T')[0],
      report: this.formatterService.formatConsole(report),
    };
  }

  async generate(date: Date, skipAi: boolean = false): Promise<DailyReport> {
    let t = Date.now();

    const events = await this.gitService.getEvents(date);
    this.logger.log(`[1/5] Events: ${events.length} (${Date.now() - t}ms)`);

    if (events.length === 0) {
      return { date, projects: [] };
    }

    t = Date.now();
    const mrData = await this.collectMRData(events, date);
    this.logger.log(
      `[2/5] MR data: ${mrData.mrInfos.size} MRs, ${mrData.aiContexts.size} AI contexts (${Date.now() - t}ms)`,
    );

    t = Date.now();
    const projectEvents = this.groupByProject(events);
    const projectNames = await this.gitService.getProjectNames(
      Array.from(projectEvents.keys()),
    );
    this.logger.log(
      `[3/5] Projects: ${projectEvents.size} (${Date.now() - t}ms)`,
    );

    t = Date.now();
    const projects: ProjectReport[] = [];

    for (const [projectId, projectEventList] of projectEvents) {
      const tasks = await this.processProject(
        projectId,
        projectEventList,
        mrData,
      );

      if (tasks.length > 0) {
        projects.push({
          projectId,
          projectName:
            projectNames.get(projectId) ||
            ReportMessage.DEFAULT_PROJECT_NAME(projectId),
          tasks,
        });
      }
    }
    this.logger.log(
      `[4/5] Tasks processed: ${projects.reduce((s, p) => s + p.tasks.length, 0)} tasks (${Date.now() - t}ms)`,
    );

    if (!skipAi && this.aiService.isEnabled()) {
      t = Date.now();
      await this.enhanceWithAI(projects);
      this.logger.log(`[5/5] AI enhancement (${Date.now() - t}ms)`);
    }

    return { date, projects };
  }

  private async collectMRData(events: GitLabEvent[], date: Date) {
    // Получаем MR из событий
    const mrRequests = this.gitService.collectMrRequests(events);
    const mrInfos = await this.gitService.getMergeRequests(mrRequests);

    // Получаем MR из push-веток
    const pushBranches = this.gitService.collectPushBranches(events);
    const branchMrs =
      await this.gitService.getMergeRequestsByBranches(pushBranches);
    for (const [key, mr] of branchMrs) {
      if (!mrInfos.has(key)) mrInfos.set(key, mr);
    }

    // Собираем source branches
    const sourceBranches = new Map<string, string>();
    for (const [key, mr] of mrInfos) {
      sourceBranches.set(key, mr.source_branch);
    }

    // Контексты комментариев и AI
    const allMrRequests = Array.from(mrInfos.entries()).map(([key, mr]) => ({
      projectId: parseInt(key.split('-')[0], 10),
      mrIid: mr.iid,
    }));

    const commentContexts =
      await this.gitService.getCommentContexts(allMrRequests);
    const aiContexts = await this.gitService.getAIContexts(allMrRequests, date);

    return { mrInfos, sourceBranches, commentContexts, aiContexts };
  }

  private async processProject(
    projectId: number,
    events: GitLabEvent[],
    mrData: Awaited<ReturnType<typeof this.collectMRData>>,
  ): Promise<TaskGroup[]> {
    const { mrInfos, sourceBranches, commentContexts, aiContexts } = mrData;

    // Сортируем и анализируем мерджи
    const sorted = [...events].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const mergeContext = this.gitService.analyzeMerges(sorted);

    // Группируем действия по задачам
    const taskActions = new Map<number, Map<TaskAction, number>>();
    const taskMrIids = new Map<number, number>();
    const miscActions = new Map<TaskAction, number>();
    const miscMrIids = new Set<number>();

    for (const event of sorted) {
      if (this.gitService.shouldSkipEvent(event, mergeContext)) continue;

      const info = this.gitService.extractTaskInfo(event, sourceBranches);

      if (info.taskId !== null) {
        if (!taskActions.has(info.taskId)) {
          taskActions.set(info.taskId, new Map());
        }
        const actions = taskActions.get(info.taskId)!;
        actions.set(info.actionType, (actions.get(info.actionType) || 0) + 1);

        // Связываем с MR
        const mrIid = this.extractMrIid(event);
        if (mrIid) taskMrIids.set(info.taskId, mrIid);
      } else {
        miscActions.set(
          info.actionType,
          (miscActions.get(info.actionType) || 0) + 1,
        );
        const mrIid = this.extractMrIid(event);
        if (mrIid) miscMrIids.add(mrIid);
      }
    }

    // Получаем информацию о задачах
    const issueRequests = Array.from(taskActions.keys()).map((taskId) => ({
      projectId,
      issueIid: taskId,
    }));
    const issues = await this.gitService.getIssues(issueRequests);

    // Формируем группы задач
    const tasks: TaskGroup[] = [];

    for (const [taskId, actionMap] of taskActions) {
      const task = this.buildTaskGroup(
        projectId,
        taskId,
        actionMap,
        taskMrIids.get(taskId),
        issues.get(`${projectId}-${taskId}`),
        mrInfos,
        commentContexts,
        aiContexts,
      );
      tasks.push(task);
    }

    // Хотфиксы без задачи
    const hotfix = this.detectHotfix(
      projectId,
      miscActions,
      miscMrIids,
      mrInfos,
    );
    if (hotfix) tasks.push(hotfix);

    return tasks;
  }

  private buildTaskGroup(
    projectId: number,
    taskId: number,
    actionMap: Map<TaskAction, number>,
    mrIid: number | undefined,
    issue: any,
    mrInfos: Map<string, any>,
    commentContexts: Map<string, any>,
    aiContexts: Map<string, any>,
  ): TaskGroup {
    const taskTitle = issue?.title || ReportMessage.DEFAULT_TASK_TITLE(taskId);
    const actions: TaskActionInfo[] = Array.from(actionMap.entries()).map(
      ([type, count]) => ({ type, count }),
    );

    // TaskInfo
    const taskInfo: TaskInfo | undefined = issue
      ? {
          title: issue.title,
          state:
            issue.state === 'closed'
              ? GitLabIssueState.CLOSED
              : GitLabIssueState.OPENED,
          labels: issue.labels,
          createdAt: new Date(issue.created_at),
          taskType: this.taskStatusService.determineTaskType(issue.labels),
        }
      : undefined;

    // Ищем MR
    const resolvedMrIid =
      mrIid || this.findMrByTaskId(projectId, taskId, mrInfos);
    const mrKey = resolvedMrIid ? `${projectId}-${resolvedMrIid}` : undefined;
    const mr = mrKey ? mrInfos.get(mrKey) : undefined;

    // MRInfo
    let mrInfo: MRInfo | undefined;
    if (mr) {
      mrInfo = this.gitService.getMRInfo(mr) || undefined;
      if (mrInfo && mrKey) {
        mrInfo.commentContext = commentContexts.get(mrKey);
      }
    }

    // Статус
    const status = this.taskStatusService.resolve(actions, taskInfo, mrInfo);

    // AI контекст
    const aiCtx = mrKey ? aiContexts.get(mrKey) : undefined;
    const aiContext: AIContext | undefined = aiCtx
      ? {
          commitMessages: aiCtx.commitMessages,
          comments: aiCtx.comments,
          mrBranch: mr?.source_branch,
          mrTitle: mr?.title,
        }
      : undefined;

    return {
      taskId,
      projectId,
      taskTitle,
      actions,
      status,
      taskInfo,
      mrInfo,
      aiContext,
    };
  }

  private detectHotfix(
    projectId: number,
    miscActions: Map<TaskAction, number>,
    miscMrIids: Set<number>,
    mrInfos: Map<string, any>,
  ): TaskGroup | null {
    if (miscActions.size === 0 || !miscActions.has(TaskAction.MERGED)) {
      return null;
    }

    for (const mrIid of miscMrIids) {
      const mr = mrInfos.get(`${projectId}-${mrIid}`);
      if (!mr) continue;

      const labels =
        mr.labels?.map((label: string) => label.toLowerCase()) || [];
      const isHotfix = labels.some(
        (label: string) =>
          label.includes(LabelType.BUG) ||
          label.includes(LabelPriority.HIGH) ||
          label.includes(LabelPriority.CRITICAL),
      );

      if (isHotfix) {
        return {
          taskId: 0,
          projectId,
          taskTitle: mr.title || ReportMessage.HOTFIX_TITLE,
          actions: Array.from(miscActions.entries()).map(([type, count]) => ({
            type,
            count,
          })),
          status: TaskStatus.HOTFIX,
        };
      }
    }

    return null;
  }

  private findMrByTaskId(
    projectId: number,
    taskId: number,
    mrInfos: Map<string, any>,
  ): number | undefined {
    for (const [key, mr] of mrInfos) {
      const [pid] = key.split('-').map(Number);
      if (
        pid === projectId &&
        (mr.source_branch.startsWith(`${taskId}-`) ||
          mr.source_branch.includes(`${taskId}-`))
      ) {
        return mr.iid;
      }
    }
    return undefined;
  }

  private extractMrIid(event: GitLabEvent): number | undefined {
    if (event.target_type === 'MergeRequest' && event.target_iid) {
      return event.target_iid;
    }
    if (
      event.note?.noteable_type === 'MergeRequest' &&
      event.note.noteable_iid
    ) {
      return event.note.noteable_iid;
    }
    return undefined;
  }

  private groupByProject(events: GitLabEvent[]): Map<number, GitLabEvent[]> {
    const map = new Map<number, GitLabEvent[]>();
    for (const event of events) {
      if (!map.has(event.project_id)) map.set(event.project_id, []);
      map.get(event.project_id)!.push(event);
    }
    return map;
  }

  private async enhanceWithAI(projects: ProjectReport[]): Promise<void> {
    const contexts: AITaskContext[] = [];
    const indexMap = new Map<number, { pIdx: number; tIdx: number }>();

    for (let pIdx = 0; pIdx < projects.length; pIdx++) {
      for (let tIdx = 0; tIdx < projects[pIdx].tasks.length; tIdx++) {
        const task = projects[pIdx].tasks[tIdx];
        if (task.taskId === 0) continue;

        contexts.push({
          taskId: task.taskId,
          taskTitle: task.taskTitle,
          status: task.status,
          commitMessages: task.aiContext?.commitMessages || [],
          comments: task.aiContext?.comments || [],
          taskType: task.taskInfo?.taskType || ('unknown' as any),
          labels: task.taskInfo?.labels || [],
          mrBranch: task.aiContext?.mrBranch,
          mrTitle: task.aiContext?.mrTitle,
        });
        indexMap.set(task.taskId, { pIdx, tIdx });
      }
    }

    if (contexts.length === 0) {
      this.logger.warn('No AI contexts to enhance');
      return;
    }

    for (const ctx of contexts) {
      this.logger.debug(
        `AI context #${ctx.taskId}: commits=[${ctx.commitMessages.join(', ')}] comments=[${ctx.comments.length}] mr="${ctx.mrTitle || '-'}"`,
      );
    }

    try {
      const descriptions = await this.aiService.enhanceTasks(contexts);
      for (const [taskId, desc] of descriptions) {
        const idx = indexMap.get(taskId);
        if (idx) projects[idx.pIdx].tasks[idx.tIdx].aiDescription = desc;
      }
    } catch (error) {
      this.logger.error('AI enhancement failed', error);
    }
  }
}
