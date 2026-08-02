import { Injectable } from '@nestjs/common';
import { GitLabRepository } from './gitlab.repository';
import {
  formatDateToISO,
  parseLocalDate,
  shiftDate,
} from 'src/common/helpers/date.helper';
import type {
  GitLabCommit,
  GitLabEvent,
  GitLabIssue,
  GitLabLabelEvent,
  GitLabMergeRequest,
  GitLabNote,
  GitLabProject,
  GitLabStateEvent,
  GitLabUser,
} from './gitlab.interface';

@Injectable()
export class GitLabService {
  constructor(private readonly gitlabRepository: GitLabRepository) {}

  async findUserByUsername(username: string): Promise<GitLabUser | null> {
    return this.gitlabRepository.findUserByUsername(username);
  }

  async getEvents(params: {
    after: string;
    before?: string;
    userId?: number;
  }): Promise<GitLabEvent[]> {
    return this.gitlabRepository.getEvents(params);
  }

  //события за конкретную дату
  //after/before в gitlab — исключающие границы по датам UTC, а день отчёта считается
  //по локальной таймзоне, поэтому берём запас в сутки с каждой стороны.
  //лишнее отсекается точным фильтром по локальному дню при сборке данных
  async getEventsForDate(userId: number, date: string): Promise<GitLabEvent[]> {
    const target = parseLocalDate(date);

    return this.getEvents({
      after: formatDateToISO(shiftDate(target, -2)),
      before: formatDateToISO(shiftDate(target, 2)),
      userId,
    });
  }

  async getUserProjects(userId: number): Promise<GitLabProject[]> {
    return this.gitlabRepository.getUserProjects(userId);
  }

  async getProject(projectId: number): Promise<GitLabProject | null> {
    return this.gitlabRepository.getProject(projectId);
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

  async getMergeRequestCommits(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabCommit[]> {
    return this.gitlabRepository.getMergeRequestCommits(projectId, mrIid);
  }

  async getCommit(
    projectId: number,
    commitId: string,
  ): Promise<GitLabCommit | null> {
    return this.gitlabRepository.getCommit(projectId, commitId);
  }

  async getIssue(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabIssue | null> {
    return this.gitlabRepository.getIssue(projectId, issueIid);
  }

  async getIssueNotes(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabNote[]> {
    return this.gitlabRepository.getIssueNotes(projectId, issueIid);
  }

  async getIssueLabelEvents(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabLabelEvent[]> {
    return this.gitlabRepository.getIssueLabelEvents(projectId, issueIid);
  }

  async getMergeRequest(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabMergeRequest | null> {
    return this.gitlabRepository.getMergeRequest(projectId, mrIid);
  }

  async getMergeRequestNotes(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabNote[]> {
    return this.gitlabRepository.getMergeRequestNotes(projectId, mrIid);
  }

  async getMergeRequestLabelEvents(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabLabelEvent[]> {
    return this.gitlabRepository.getMergeRequestLabelEvents(projectId, mrIid);
  }

  async getIssueStateEvents(
    projectId: number,
    issueIid: number,
  ): Promise<GitLabStateEvent[]> {
    return this.gitlabRepository.getIssueStateEvents(projectId, issueIid);
  }

  async getMergeRequestStateEvents(
    projectId: number,
    mrIid: number,
  ): Promise<GitLabStateEvent[]> {
    return this.gitlabRepository.getMergeRequestStateEvents(projectId, mrIid);
  }
}
