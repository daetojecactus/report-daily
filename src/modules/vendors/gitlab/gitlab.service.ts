import { Injectable } from '@nestjs/common';
import { GitLabRepository } from './gitlab.repository';

@Injectable()
export class GitLabService {
  constructor(private readonly gitlabRepository: GitLabRepository) {}

  async findUserByUsername(username: string) {
    return this.gitlabRepository.findUserByUsername(username);
  }

  async getEvents(params: { after: string; before?: string; userId?: number }) {
    return this.gitlabRepository.getEvents(params);
  }

  //события за конкретную дату (after/before — исключающие)
  async getEventsForDate(userId: number, date: string) {
    const target = new Date(date);
    const dayBefore = new Date(target);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayAfter = new Date(target);
    dayAfter.setDate(dayAfter.getDate() + 1);

    return this.getEvents({
      after: dayBefore.toISOString().split('T')[0],
      before: dayAfter.toISOString().split('T')[0],
      userId,
    });
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

  async getIssueLabelEvents(projectId: number, issueIid: number) {
    return this.gitlabRepository.getIssueLabelEvents(projectId, issueIid);
  }

  async getMergeRequest(projectId: number, mrIid: number) {
    return this.gitlabRepository.getMergeRequest(projectId, mrIid);
  }

  async getMergeRequestNotes(projectId: number, mrIid: number) {
    return this.gitlabRepository.getMergeRequestNotes(projectId, mrIid);
  }

  async getMergeRequestLabelEvents(projectId: number, mrIid: number) {
    return this.gitlabRepository.getMergeRequestLabelEvents(projectId, mrIid);
  }

  async getIssueStateEvents(projectId: number, issueIid: number) {
    return this.gitlabRepository.getIssueStateEvents(projectId, issueIid);
  }

  async getMergeRequestStateEvents(projectId: number, mrIid: number) {
    return this.gitlabRepository.getMergeRequestStateEvents(projectId, mrIid);
  }
}
