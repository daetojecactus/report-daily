import { Injectable, Logger } from '@nestjs/common';
import { getFailureReason } from 'src/common/utils/error.util';
import {
  GITLAB_CLOSES_ISSUES_PATH,
  GITLAB_COMMITS_PATH,
  GITLAB_EVENTS_PATH,
  GITLAB_LABEL_EVENTS_PATH,
  GITLAB_MAX_PAGES,
  GITLAB_NEXT_PAGE_HEADER,
  GITLAB_NOT_FOUND,
  GITLAB_NOTES_PATH,
  GITLAB_PAGE_SIZE,
  GITLAB_PROJECTS_PATH,
  GITLAB_REPOSITORY_COMMITS_PATH,
  GITLAB_RETRY_AFTER_HEADER,
  GITLAB_SERVER_ERROR,
  GITLAB_STATE_EVENTS_PATH,
  GITLAB_TOO_MANY_REQUESTS,
  GITLAB_USER_SEARCH_LIMIT,
  GITLAB_USERS_PATH,
} from './constants/gitlab.constants';
import { GitLabMessages } from './constants/gitlab.messages';
import { GitLabClient } from './gitlab.client';
import { GitLabIssuable } from './gitlab.enums';
import { GitLabRejectedError, GitLabRetryableError } from './gitlab.error';
import type {
  GitLabCommit,
  GitLabEvent,
  GitLabHttpResponse,
  GitLabIssue,
  GitLabLabelEvent,
  GitLabMergeRequest,
  GitLabNote,
  GitLabPage,
  GitLabProject,
  GitLabQuery,
  GitLabStateEvent,
  GitLabUser,
} from './gitlab.interface';

@Injectable()
export class GitLabRepository {
  private readonly logger = new Logger(GitLabRepository.name);

  constructor(private readonly gitlabClient: GitLabClient) {}

  async searchUsers(search: string) {
    const users = await this.get<GitLabUser[]>(GITLAB_USERS_PATH, {
      search,
      active: true,
      per_page: GITLAB_USER_SEARCH_LIMIT,
    });
    return users ?? [];
  }

  findUser(id: number) {
    return this.get<GitLabUser>(`${GITLAB_USERS_PATH}/${id}`);
  }

  async findLastUserEvent(userId: number) {
    const events = await this.get<GitLabEvent[]>(
      `${GITLAB_USERS_PATH}/${userId}${GITLAB_EVENTS_PATH}`,
      { per_page: 1 },
    );
    return events?.[0] ?? null;
  }

  findUserEvents(userId: number, after: string, before: string) {
    return this.getAll<GitLabEvent>(
      `${GITLAB_USERS_PATH}/${userId}${GITLAB_EVENTS_PATH}`,
      { after, before },
    );
  }

  findProject(projectId: number) {
    return this.get<GitLabProject>(`${GITLAB_PROJECTS_PATH}/${projectId}`);
  }

  findIssue(projectId: number, iid: number) {
    return this.get<GitLabIssue>(
      this.toIssuablePath(GitLabIssuable.ISSUES, projectId, iid),
    );
  }

  findMergeRequest(projectId: number, iid: number) {
    return this.get<GitLabMergeRequest>(
      this.toIssuablePath(GitLabIssuable.MERGE_REQUESTS, projectId, iid),
    );
  }

  async findMergeRequestByBranch(projectId: number, branch: string) {
    const mergeRequests = await this.get<GitLabMergeRequest[]>(
      `${GITLAB_PROJECTS_PATH}/${projectId}/${GitLabIssuable.MERGE_REQUESTS}`,
      { source_branch: branch, per_page: 1 },
    );
    return mergeRequests?.[0] ?? null;
  }

  findIssuesClosedOnMerge(projectId: number, iid: number) {
    return this.getAll<GitLabIssue>(
      `${this.toIssuablePath(GitLabIssuable.MERGE_REQUESTS, projectId, iid)}${GITLAB_CLOSES_ISSUES_PATH}`,
    );
  }

  findNotes(issuable: GitLabIssuable, projectId: number, iid: number) {
    return this.getAll<GitLabNote>(
      `${this.toIssuablePath(issuable, projectId, iid)}${GITLAB_NOTES_PATH}`,
    );
  }

  findLabelEvents(issuable: GitLabIssuable, projectId: number, iid: number) {
    return this.getAll<GitLabLabelEvent>(
      `${this.toIssuablePath(issuable, projectId, iid)}${GITLAB_LABEL_EVENTS_PATH}`,
    );
  }

  findStateEvents(issuable: GitLabIssuable, projectId: number, iid: number) {
    return this.getAll<GitLabStateEvent>(
      `${this.toIssuablePath(issuable, projectId, iid)}${GITLAB_STATE_EVENTS_PATH}`,
    );
  }

  async findCommits(projectId: number, ref: string, limit: number) {
    const commits = await this.get<GitLabCommit[]>(
      `${GITLAB_PROJECTS_PATH}/${projectId}${GITLAB_REPOSITORY_COMMITS_PATH}`,
      { ref_name: ref, per_page: limit },
    );
    return commits ?? [];
  }

  findMergeRequestCommits(projectId: number, iid: number) {
    return this.getAll<GitLabCommit>(
      `${this.toIssuablePath(GitLabIssuable.MERGE_REQUESTS, projectId, iid)}${GITLAB_COMMITS_PATH}`,
    );
  }

  private async get<T>(path: string, query: GitLabQuery = {}) {
    const page = await this.getPage<T>(path, query);
    return page?.body ?? null;
  }

  private async getAll<T>(path: string, query: GitLabQuery = {}) {
    const items: T[] = [];
    let page: number | null = 1;
    for (let count = 0; page !== null; count += 1) {
      if (count === GITLAB_MAX_PAGES) {
        this.logger.warn({ path }, GitLabMessages.PAGE_LIMIT_REACHED);
        break;
      }
      const response: GitLabPage<T[]> | null = await this.getPage<T[]>(path, {
        ...query,
        per_page: GITLAB_PAGE_SIZE,
        page,
      });
      if (!response) {
        break;
      }
      items.push(...response.body);
      page = response.nextPage;
    }
    return items;
  }

  private async getPage<T>(
    path: string,
    query: GitLabQuery,
  ): Promise<GitLabPage<T> | null> {
    const response = await this.gitlabClient.get(path, query);
    if (response.status === GITLAB_NOT_FOUND) {
      return null;
    }
    if (!response.ok) {
      throw this.toError(path, response);
    }

    try {
      return {
        body: JSON.parse(response.body) as T,
        nextPage: this.toNextPage(response),
      };
    } catch (error) {
      throw new GitLabRetryableError(
        `${GitLabMessages.INVALID_RESPONSE}: ${path}: ${getFailureReason(error)}`,
      );
    }
  }

  private toNextPage(response: GitLabHttpResponse) {
    const page = Number(response.headers.get(GITLAB_NEXT_PAGE_HEADER));
    return Number.isInteger(page) && page > 0 ? page : null;
  }

  private toError(path: string, response: GitLabHttpResponse) {
    const message = `${GitLabMessages.API_ERROR}: ${path}: ${response.status}`;
    if (
      response.status === GITLAB_TOO_MANY_REQUESTS ||
      response.status >= GITLAB_SERVER_ERROR
    ) {
      const retryAfter = Number(
        response.headers.get(GITLAB_RETRY_AFTER_HEADER),
      );
      return new GitLabRetryableError(
        message,
        Number.isInteger(retryAfter) && retryAfter > 0 ? retryAfter : null,
      );
    }
    return new GitLabRejectedError(message, response.status);
  }

  private toIssuablePath(
    issuable: GitLabIssuable,
    projectId: number,
    iid: number,
  ) {
    return `${GITLAB_PROJECTS_PATH}/${projectId}/${issuable}/${iid}`;
  }
}
