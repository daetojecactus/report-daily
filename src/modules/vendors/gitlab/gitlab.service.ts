import { Injectable } from "@nestjs/common";
import { GitLabRepository } from "./gitlab.repository";
import type {
  GitLabEvent,
  GitLabProject,
  GitLabIssue,
  GitLabMergeRequest,
  GitLabMRNote,
  GitLabCommit,
} from "./gitlab.types";

@Injectable()
export class GitLabService {
  constructor(private readonly gitlabRepository: GitLabRepository) {}

  async getEvents(afterDate: string): Promise<GitLabEvent[]> {
    return this.gitlabRepository.getEvents(afterDate);
  }

  async getProject(projectId: number): Promise<GitLabProject> {
    return this.gitlabRepository.getProject(projectId);
  }

  async getIssue(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabIssue | null> {
    return this.gitlabRepository.getIssue(projectId, issueIid);
  }

  async getMergeRequest(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabMergeRequest | null> {
    return this.gitlabRepository.getMergeRequest(projectId, mrIid);
  }

  async getMergeRequestByBranch(
    projectId: number,
    sourceBranch: string,
  ): Promise<GitLabMergeRequest | null> {
    return this.gitlabRepository.getMergeRequestByBranch(
      projectId,
      sourceBranch,
    );
  }

  async getMergeRequestNotes(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabMRNote[]> {
    const notes = await this.gitlabRepository.getMergeRequestNotes(
      projectId,
      mrIid,
    );
    return notes.filter((note) => !note.system);
  }

  async getMergeRequestCommits(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabCommit[]> {
    return this.gitlabRepository.getMergeRequestCommits(projectId, mrIid);
  }
}
