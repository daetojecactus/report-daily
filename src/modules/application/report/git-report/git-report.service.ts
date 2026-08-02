import { Injectable, Logger } from '@nestjs/common';
import { GitGroupService } from './git-group/git-group.service';
import { GitMapperService } from './git-mapper/git-mapper.service';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import { ReportMessages } from '../constants/report.messages';
import {
  GitDailyReport,
  ProjectReportGroup,
  ReportTaskItem,
} from './git-report.interface';
import {
  MappedDailyData,
  MappedIssue,
  MappedMergeRequest,
  MappedPush,
} from './git-mapper/git-mapper.interface';
import { CleanEvent, CleanNote } from './git-group/git-group.interface';
import { DefaultMessages } from 'src/common/constants/default.messages';
import { UserRole } from '../../user/user.enums';
import { LabelScope, LabelType } from 'src/common/enums/label.enum';
import { hasLabelValue, parseLabels } from 'src/common/helpers/label.helper';

@Injectable()
export class GitReportService {
  private readonly logger = new Logger(GitReportService.name);

  constructor(
    private readonly gitGroupService: GitGroupService,
    private readonly gitMapperService: GitMapperService,
    private readonly gitLabService: GitLabService,
  ) {}

  //собирает полный отчет за день
  async generateDailyReport(
    gitLabUserId: number,
    username: string,
    userRole: UserRole,
    date: string,
  ): Promise<GitDailyReport> {
    //группируем сырые события
    const grouped = await this.gitGroupService.collectAndGroupDailyEvents(
      gitLabUserId,
      date,
    );

    //маппим на статусы
    const mapped = this.gitMapperService.mapDailyData(
      grouped,
      username,
      userRole,
      date,
    );

    //собираем все уникальные projectId для резолва имен
    const projectIds = this.collectProjectIds(mapped);
    const projectNames = await this.resolveProjectNames(projectIds);

    //собираем задачи по проектам
    const projectsMap = new Map<number, ReportTaskItem[]>();

    //задачи (issues)
    for (const issue of mapped.issues) {
      if (this.isExcludedFromReport(issue.labels)) continue;
      const item = this.buildIssueReportItem(issue, username);
      this.addToProjectMap(projectsMap, issue.projectId, item);
    }

    //standalone мр (хотфиксы и тд)
    for (const mr of mapped.standaloneMergeRequests) {
      if (this.isExcludedFromReport(mr.labels)) continue;
      const item = this.buildMergeRequestReportItem(mr, username);
      this.addToProjectMap(projectsMap, mr.projectId, item);
    }

    //standalone пуши
    for (const push of mapped.standalonePushes) {
      const item = this.buildPushReportItem(push);
      this.addToProjectMap(projectsMap, push.projectId, item);
    }

    //формируем итоговые проекты
    const projects: ProjectReportGroup[] = [];
    for (const [projectId, tasks] of projectsMap) {
      projects.push({
        projectId,
        projectName:
          projectNames.get(projectId) ??
          `${DefaultMessages.DEFAULT_PROJECT}_${projectId}`,
        tasks,
      });
    }

    return { date, projects };
  }

  //строим элемент отчета из задачи (issue + привязанные мр)
  private buildIssueReportItem(
    issue: MappedIssue,
    username: string,
  ): ReportTaskItem {
    const commitMessages = issue.mergeRequests.flatMap((mr) =>
      this.extractCommitMessages(mr.events),
    );

    const allNotes = [
      ...issue.notes,
      ...issue.mergeRequests.flatMap((mr) => mr.notes),
    ];
    const userComments = this.extractUserComments(allNotes, username);

    //mrTitle передаем только если есть реальные коммиты/комментарии,
    //иначе AI галлюцинирует детали из названия ветки
    const hasMeaningfulContext =
      commitMessages.length > 0 || userComments.length > 0;

    const mrTitle = hasMeaningfulContext
      ? (issue.mergeRequests[0]?.title ?? null)
      : null;

    return {
      taskKey: `${issue.projectId}:${issue.iid}`,
      projectId: issue.projectId,
      iid: issue.iid,
      title: issue.title,
      webUrl: issue.webUrl,
      status: issue.workResult.status,
      taskType: issue.workResult.taskType,
      labels: issue.labels,
      priority:
        this.resolvePriority(issue.labels) ??
        this.resolvePriority(issue.mergeRequests[0]?.labels ?? []),
      aiContext: { commitMessages, userComments, mrTitle },
    };
  }

  //строим элемент отчета из standalone мр
  private buildMergeRequestReportItem(
    mr: MappedMergeRequest,
    username: string,
  ): ReportTaskItem {
    const commitMessages = this.extractCommitMessages(mr.events);
    const userComments = this.extractUserComments(mr.notes, username);
    const hasMeaningfulContext =
      commitMessages.length > 0 || userComments.length > 0;

    return {
      taskKey: `${mr.projectId}:mr-${mr.iid}`,
      projectId: mr.projectId,
      iid: mr.iid,
      title: mr.title,
      webUrl: mr.webUrl,
      status: mr.workResult.status,
      taskType: mr.workResult.taskType,
      labels: mr.labels,
      priority: this.resolvePriority(mr.labels),
      aiContext: {
        commitMessages,
        userComments,
        mrTitle: hasMeaningfulContext ? mr.title : null,
      },
    };
  }

  //строим элемент отчета из standalone пуша
  private buildPushReportItem(push: MappedPush): ReportTaskItem {
    return {
      taskKey: `${push.projectId}:push-${push.branch}`,
      projectId: push.projectId,
      iid: 0,
      title: push.branch,
      webUrl: null,
      status: push.workResult.status,
      taskType: push.workResult.taskType,
      labels: [],
      priority: null,
      aiContext: {
        commitMessages: this.extractCommitMessages(push.events),
        userComments: [],
        mrTitle: null,
      },
    };
  }

  //задача помечена лейблом type::ignore — команда не хочет видеть её в отчёте
  private isExcludedFromReport(labels: string[]): boolean {
    return hasLabelValue(
      parseLabels(labels),
      LabelScope.TYPE,
      LabelType.IGNORE,
    );
  }

  //извлекает приоритет из scoped-лейбла priority::* → "HIGH" (иначе null)
  private resolvePriority(labels: string[]): string | null {
    for (const label of labels) {
      const [scope, ...rest] = label.split('::');
      if (scope.trim().toLowerCase() === 'priority' && rest.length > 0) {
        return rest.join('::').trim().toUpperCase();
      }
    }
    return null;
  }

  //извлекает сообщения коммитов из событий с pushData
  private extractCommitMessages(events: CleanEvent[]): string[] {
    const messages: string[] = [];
    for (const event of events) {
      if (event.pushData?.commitTitle) {
        messages.push(event.pushData.commitTitle);
      }
    }
    return messages;
  }

  //извлекает НЕ системные комментарии пользователя
  private extractUserComments(notes: CleanNote[], username: string): string[] {
    return notes
      .filter((note) => note.authorUsername === username && !note.system)
      .map((note) => note.body);
  }

  //собирает все уникальные projectId из маппинга
  private collectProjectIds(mapped: MappedDailyData): number[] {
    const ids = new Set<number>();
    mapped.issues.forEach((issue) => ids.add(issue.projectId));
    mapped.standaloneMergeRequests.forEach((mergeRequest) =>
      ids.add(mergeRequest.projectId),
    );
    mapped.standalonePushes.forEach((push) => ids.add(push.projectId));
    return [...ids];
  }

  //резолвит имена проектов по id
  private async resolveProjectNames(
    projectIds: number[],
  ): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    await Promise.all(
      projectIds.map(async (id) => {
        try {
          const project = await this.gitLabService.getProject(id);
          names.set(
            id,
            project?.name ?? `${DefaultMessages.DEFAULT_PROJECT}_${id}`,
          );
        } catch {
          this.logger.warn(
            `${ReportMessages.REPORT_PROJECT_RESOLVE_FAILED}: ${id}`,
          );
          names.set(id, `${DefaultMessages.DEFAULT_PROJECT}_${id}`);
        }
      }),
    );
    return names;
  }

  //добавляет задачу в map проектов
  private addToProjectMap(
    map: Map<number, ReportTaskItem[]>,
    projectId: number,
    item: ReportTaskItem,
  ): void {
    const tasks = map.get(projectId) ?? [];
    tasks.push(item);
    map.set(projectId, tasks);
  }
}
