import { Injectable } from "@nestjs/common";
import { GitLabClient } from "./gitlab.client";
import type {
  GitLabEvent,
  GitLabProject,
  GitLabIssue,
  GitLabMergeRequest,
  GitLabMRNote,
  GitLabCommit,
} from "./gitlab.types";

@Injectable()
export class GitLabRepository {
  constructor(private readonly gitlabClient: GitLabClient) {}

  async getEvents(afterDate: string): Promise<GitLabEvent[]> {
    const { data } = await this.gitlabClient.instance.get<GitLabEvent[]>(
      "/events",
      {
        params: {
          after: afterDate,
          per_page: this.gitlabClient.getEventsPerPage(),
        },
      },
    );
    return data;
  }

  async getProject(projectId: number): Promise<GitLabProject> {
    const { data } = await this.gitlabClient.instance.get<GitLabProject>(
      `/projects/${projectId}`,
    );
    return data;
  }

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

  async getMergeRequestByBranch(
    projectId: number,
    sourceBranch: string,
  ): Promise<GitLabMergeRequest | null> {
    try {
      const { data } = await this.gitlabClient.instance.get<
        GitLabMergeRequest[]
      >(`/projects/${projectId}/merge_requests`, {
        params: {
          source_branch: sourceBranch,
          state: "opened",
          per_page: 1,
        },
      });
      return data[0] || null;
    } catch {
      return null;
    }
  }

  async getMergeRequestNotes(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabMRNote[]> {
    try {
      const { data } = await this.gitlabClient.instance.get<GitLabMRNote[]>(
        `/projects/${projectId}/merge_requests/${mrIid}/notes`,
        { params: { per_page: 100, sort: "asc" } },
      );
      return data;
    } catch {
      return [];
    }
  }

  async getMergeRequestCommits(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabCommit[]> {
    try {
      const { data } = await this.gitlabClient.instance.get<GitLabCommit[]>(
        `/projects/${projectId}/merge_requests/${mrIid}/commits`,
        { params: { per_page: 100 } },
      );
      return data;
    } catch {
      return [];
    }
  }
}
