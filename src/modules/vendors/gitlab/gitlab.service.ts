import { Injectable } from '@nestjs/common';
import {
  GITLAB_EVENTS_PATH,
  GITLAB_USER_SEARCH_LIMIT,
  GITLAB_USERS_PATH,
} from './constants/gitlab.constants';
import { GitLabClient } from './gitlab.client';
import type { GitLabUser } from './gitlab.interface';

@Injectable()
export class GitLabService {
  constructor(private readonly gitlabClient: GitLabClient) {}

  async searchUsers(search: string) {
    const users = await this.gitlabClient.get<GitLabUser[]>(GITLAB_USERS_PATH, {
      search,
      active: true,
      per_page: GITLAB_USER_SEARCH_LIMIT,
    });
    return users ?? [];
  }

  findUser(id: number) {
    return this.gitlabClient.get<GitLabUser>(`${GITLAB_USERS_PATH}/${id}`);
  }

  async hasVisibleActivity(userId: number) {
    const events = await this.gitlabClient.get<unknown[]>(
      `${GITLAB_USERS_PATH}/${userId}${GITLAB_EVENTS_PATH}`,
      { per_page: 1 },
    );
    return (events?.length ?? 0) > 0;
  }
}
