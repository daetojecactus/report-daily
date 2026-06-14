import { Injectable } from '@nestjs/common';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import {
  GitLabCommit,
  GitLabEvent,
  GitLabIssue,
  GitLabLabelEvent,
  GitLabMergeRequest,
  GitLabNote,
  GitLabStateEvent,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import {
  extractIssueIdFromBranch,
  fromKey,
  toKey,
} from './git-group.event-parser';

//загрузка и догрузка данных из gitlab: задачи, мр, комментарии, история лейблов и состояний
@Injectable()
export class GitGroupFetcher {
  constructor(private readonly gitlabService: GitLabService) {}

  //загружает события пользователя за день
  fetchEvents(userId: number, date: string): Promise<GitLabEvent[]> {
    return this.gitlabService.getEventsForDate(userId, date);
  }

  //загружает детальную информацию о задачах
  async fetchIssueDetails(
    keys: Set<string>,
  ): Promise<Map<string, GitLabIssue>> {
    const map = new Map<string, GitLabIssue>();

    await Promise.all(
      Array.from(keys).map(async (key) => {
        const { projectId, iid } = fromKey(key);
        const issue = await this.gitlabService.getIssue(projectId, iid);
        if (issue) map.set(key, issue);
      }),
    );

    return map;
  }

  //загружает детальную информацию о мр
  async fetchMergeRequestDetails(
    keys: Set<string>,
  ): Promise<Map<string, GitLabMergeRequest>> {
    const map = new Map<string, GitLabMergeRequest>();

    await Promise.all(
      Array.from(keys).map(async (key) => {
        const { projectId, iid } = fromKey(key);
        const mr = await this.gitlabService.getMergeRequest(projectId, iid);
        if (mr) map.set(key, mr);
      }),
    );

    return map;
  }

  //связывает мр с задачами по номеру в названии ветки
  linkMergeRequestsToIssues(
    mrsMap: Map<string, GitLabMergeRequest>,
    issuesMap: Map<string, GitLabIssue>,
  ): Map<string, string> {
    const links = new Map<string, string>();

    for (const [mrKey, mr] of mrsMap) {
      const issueIid = extractIssueIdFromBranch(mr.source_branch);
      if (!issueIid) continue;

      const issueKey = toKey(mr.project_id, issueIid);
      if (issuesMap.has(issueKey)) {
        links.set(mrKey, issueKey);
      }
    }

    return links;
  }

  //подтягивает задачи для мр у которых есть номер задачи в ветке, но задача не попала в events
  async resolveOrphanMergeRequests(
    mrsMap: Map<string, GitLabMergeRequest>,
    issuesMap: Map<string, GitLabIssue>,
    mrToIssueLinks: Map<string, string>,
  ): Promise<void> {
    const orphanMrs = Array.from(mrsMap.entries()).filter(
      ([mrKey]) => !mrToIssueLinks.has(mrKey),
    );

    await Promise.all(
      orphanMrs.map(async ([mrKey, mr]) => {
        const issueIid = extractIssueIdFromBranch(mr.source_branch);
        if (!issueIid) return;

        const issueKey = toKey(mr.project_id, issueIid);
        if (issuesMap.has(issueKey)) return;

        const issue = await this.gitlabService.getIssue(
          mr.project_id,
          issueIid,
        );
        if (issue) {
          issuesMap.set(issueKey, issue);
          mrToIssueLinks.set(mrKey, issueKey);
        }
      }),
    );
  }

  //подтягивает мр и задачи для пушей в feature-ветки без привязки
  async resolvePushBranches(
    pushBranches: { projectId: number; branch: string }[],
    mrsMap: Map<string, GitLabMergeRequest>,
    issuesMap: Map<string, GitLabIssue>,
    mrToIssueLinks: Map<string, string>,
    existingMrKeys: Set<string>,
  ): Promise<void> {
    await Promise.all(
      pushBranches.map(async ({ projectId, branch }) => {
        //проверяем, есть ли уже мр для этой ветки
        const hasExistingMr = Array.from(mrsMap.values()).some(
          (mr) => mr.project_id === projectId && mr.source_branch === branch,
        );
        if (hasExistingMr) return;

        //ищем мр по ветке
        const mr = await this.gitlabService.getMergeRequestByBranch(
          projectId,
          branch,
        );
        if (!mr) return;

        const mrKey = toKey(projectId, mr.iid);
        if (existingMrKeys.has(mrKey)) return;

        mrsMap.set(mrKey, mr);

        //пробуем найти задачу по номеру из ветки
        const issueIid = extractIssueIdFromBranch(branch);
        if (!issueIid) return;

        const issueKey = toKey(projectId, issueIid);
        if (issuesMap.has(issueKey)) {
          mrToIssueLinks.set(mrKey, issueKey);
          return;
        }

        const issue = await this.gitlabService.getIssue(projectId, issueIid);
        if (issue) {
          issuesMap.set(issueKey, issue);
          mrToIssueLinks.set(mrKey, issueKey);
        }
      }),
    );
  }

  //загружает комментарии для всех задач
  async fetchNotesForIssues(
    issuesMap: Map<string, GitLabIssue>,
  ): Promise<Map<string, GitLabNote[]>> {
    const map = new Map<string, GitLabNote[]>();

    await Promise.all(
      Array.from(issuesMap.entries()).map(async ([key, issue]) => {
        const notes = await this.gitlabService.getIssueNotes(
          issue.project_id,
          issue.iid,
        );
        map.set(key, notes);
      }),
    );

    return map;
  }

  //загружает историю лейблов для всех задач
  async fetchLabelEventsForIssues(
    issuesMap: Map<string, GitLabIssue>,
  ): Promise<Map<string, GitLabLabelEvent[]>> {
    const map = new Map<string, GitLabLabelEvent[]>();

    await Promise.all(
      Array.from(issuesMap.entries()).map(async ([key, issue]) => {
        const events = await this.gitlabService.getIssueLabelEvents(
          issue.project_id,
          issue.iid,
        );
        map.set(key, events);
      }),
    );

    return map;
  }

  //загружает комментарии для всех мр
  async fetchNotesForMRs(
    mrsMap: Map<string, GitLabMergeRequest>,
  ): Promise<Map<string, GitLabNote[]>> {
    const map = new Map<string, GitLabNote[]>();

    await Promise.all(
      Array.from(mrsMap.entries()).map(async ([key, mr]) => {
        const notes = await this.gitlabService.getMergeRequestNotes(
          mr.project_id,
          mr.iid,
        );
        map.set(key, notes);
      }),
    );

    return map;
  }

  //загружает историю лейблов для всех мр
  async fetchLabelEventsForMRs(
    mrsMap: Map<string, GitLabMergeRequest>,
  ): Promise<Map<string, GitLabLabelEvent[]>> {
    const map = new Map<string, GitLabLabelEvent[]>();

    await Promise.all(
      Array.from(mrsMap.entries()).map(async ([key, mr]) => {
        const events = await this.gitlabService.getMergeRequestLabelEvents(
          mr.project_id,
          mr.iid,
        );
        map.set(key, events);
      }),
    );

    return map;
  }

  //загружает историю смены состояний для задач
  async fetchStateEventsForIssues(
    issuesMap: Map<string, GitLabIssue>,
  ): Promise<Map<string, GitLabStateEvent[]>> {
    const map = new Map<string, GitLabStateEvent[]>();

    await Promise.all(
      Array.from(issuesMap.entries()).map(async ([key, issue]) => {
        const events = await this.gitlabService.getIssueStateEvents(
          issue.project_id,
          issue.iid,
        );
        map.set(key, events);
      }),
    );

    return map;
  }

  //загружает историю смены состояний для мр
  async fetchStateEventsForMRs(
    mrsMap: Map<string, GitLabMergeRequest>,
  ): Promise<Map<string, GitLabStateEvent[]>> {
    const map = new Map<string, GitLabStateEvent[]>();

    await Promise.all(
      Array.from(mrsMap.entries()).map(async ([key, mr]) => {
        const events = await this.gitlabService.getMergeRequestStateEvents(
          mr.project_id,
          mr.iid,
        );
        map.set(key, events);
      }),
    );

    return map;
  }

  //загружает коммиты для всех мр (нужны для определения возобновления работы)
  async fetchCommitsForMRs(
    mrsMap: Map<string, GitLabMergeRequest>,
  ): Promise<Map<string, GitLabCommit[]>> {
    const map = new Map<string, GitLabCommit[]>();

    await Promise.all(
      Array.from(mrsMap.entries()).map(async ([key, mr]) => {
        const commits = await this.gitlabService.getMergeRequestCommits(
          mr.project_id,
          mr.iid,
        );
        map.set(key, commits);
      }),
    );

    return map;
  }
}
