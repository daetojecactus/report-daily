import { Injectable } from '@nestjs/common';
import { GitLabClient } from './gitlab.client';
import {
  GitLabCommit,
  GitLabEvent,
  GitLabIssue,
  GitLabLabelEvent,
  GitLabMergeRequest,
  GitLabNote,
} from './gitlab.types';

@Injectable()
export class GitLabRepository {
  constructor(private readonly gitlabClient: GitLabClient) {}

  //получаем события из ленты активности пользователя
  async getEvents(afterDate: string, userId?: number): Promise<GitLabEvent[]> {
    const { data } = await this.gitlabClient.instance.get<GitLabEvent[]>(
      userId ? `/users/${userId}/events` : '/events',
      {
        params: {
          after: afterDate,
          per_page: 100,
          sort: 'desc',
        },
      },
    );
    return data;
  }

  //получаем историю изменения лейблов в мр
  async getMergeRequestLabelEvents(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabLabelEvent[]> {
    try {
      const { data } = await this.gitlabClient.instance.get<GitLabLabelEvent[]>(
        `/projects/${projectId}/merge_requests/${mrIid}/resource_label_events`,
      );
      return data;
    } catch {
      return [];
    }
  }

  //получаем историю изменения лейблов в задаче
  async getIssueLabelEvents(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabLabelEvent[]> {
    try {
      const { data } = await this.gitlabClient.instance.get<GitLabLabelEvent[]>(
        `/projects/${projectId}/issues/${issueIid}/resource_label_events`,
      );
      return data;
    } catch {
      return [];
    }
  }

  //получаем проекты
  async getUserProjects(userId: number) {
    const { data } = await this.gitlabClient.instance.get(
      `/users/${userId}/projects`,
      { params: { min_access_level: 30 } }, // Developer access and above
    );
    return data;
  }

  //получаем задачу
  async getIssue(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabIssue | null> {
    try {
      const { data } = await this.gitlabClient.instance.get<GitLabIssue>(
        `/projects/${projectId}/issues/${issueIid}`,
      );
      return data;
    } catch {
      return null;
    }
  }

  //получаем мр
  async getMergeRequest(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabMergeRequest | null> {
    try {
      const { data } = await this.gitlabClient.instance.get<GitLabMergeRequest>(
        `/projects/${projectId}/merge_requests/${mrIid}`,
      );
      return data;
    } catch {
      return null;
    }
  }

  //получаем комментарии к мр
  async getMergeRequestNotes(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabNote[]> {
    try {
      const { data } = await this.gitlabClient.instance.get<GitLabNote[]>(
        `/projects/${projectId}/merge_requests/${mrIid}/notes`,
        { params: { sort: 'desc', per_page: 50 } },
      );
      return data;
    } catch {
      return [];
    }
  }

  async getIssueNotes(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabNote[]> {
    try {
      const { data } = await this.gitlabClient.instance.get<GitLabNote[]>(
        `/projects/${projectId}/issues/${issueIid}/notes`,
        { params: { sort: 'desc', per_page: 50 } },
      );
      return data;
    } catch {
      return [];
    }
  }

  //получаем коммит
  async getCommit(
    projectId: number,
    commitId: string,
  ): Promise<GitLabCommit | null> {
    try {
      const { data } = await this.gitlabClient.instance.get<GitLabCommit>(
        `/projects/${projectId}/repository/commits/${commitId}`,
      );
      return data;
    } catch {
      return null;
    }
  }
}
