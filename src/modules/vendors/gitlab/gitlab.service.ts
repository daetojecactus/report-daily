import { Injectable } from '@nestjs/common';
import { GitLabRepository } from './gitlab.repository';

@Injectable()
export class GitLabService {
  constructor(private readonly gitlabRepository: GitLabRepository) {}

  async findUserByUsername(username: string) {
    return this.gitlabRepository.findUserByUsername(username);
  }

  async getEvents(afterDate: string, userId?: number) {
    return this.gitlabRepository.getEvents(afterDate, userId);
  }

  async getUserProjects(userId: number) {
    return this.gitlabRepository.getUserProjects(userId);
  }

  async getProject(projectId: number) {
    return this.gitlabRepository.getProject(projectId);
  }

  async getMergeRequestByBranch(projectId: number, sourceBranch: string) {
    return this.gitlabRepository.getMergeRequestByBranch(
      projectId,
      sourceBranch,
    );
  }

  async getMergeRequestCommits(projectId: number, mrIid: number) {
    return this.gitlabRepository.getMergeRequestCommits(projectId, mrIid);
  }

  async getCommit(projectId: number, commitId: string) {
    return this.gitlabRepository.getCommit(projectId, commitId);
  }

  async getIssue(projectId: number, issueIid: number) {
    return this.gitlabRepository.getIssue(projectId, issueIid);
  }

  async getIssueNotes(projectId: number, issueIid: number) {
    return this.gitlabRepository.getIssueNotes(projectId, issueIid);
  }

  async getIssueSystemNotes(projectId: number, issueIid: number) {
    const notes = await this.getIssueNotes(projectId, issueIid);
    return notes.filter((note) => note.system === true);
  }

  async getIssueLabelEvents(projectId: number, issueIid: number) {
    return this.gitlabRepository.getIssueLabelEvents(projectId, issueIid);
  }

  async getMergeRequest(projectId: number, mrIid: number) {
    return this.gitlabRepository.getMergeRequest(projectId, mrIid);
  }

  async getMergeRequestNotes(projectId: number, mrIid: number) {
    return this.gitlabRepository.getMergeRequestNotes(projectId, mrIid);
  }

  async getMergeRequestSystemNotes(projectId: number, mrIid: number) {
    const notes = await this.getMergeRequestNotes(projectId, mrIid);
    return notes.filter((note) => note.system === true);
  }

  async getMergeRequestLabelEvents(projectId: number, mrIid: number) {
    return this.gitlabRepository.getMergeRequestLabelEvents(projectId, mrIid);
  }
}
