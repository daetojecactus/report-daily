import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GitLabService } from '../../vendors/gitlab/gitlab.service';
import { TaskAction } from '../../../common/enums/task.enum';
import {
  GitLabTargetType,
  GitLabAction,
  MainBranch,
} from '../../../common/enums/gitlab.enum';
import { LabelStatus } from '../../../common/enums/label.enum';
import { GitPattern, GitMessages } from './constants/git.messages';
import type {
  GitLabEvent,
  GitLabMergeRequest,
  GitLabNote,
} from '../../vendors/gitlab/gitlab.types';
import type {
  MergeContext,
  EventTaskInfo,
  CommentContext,
  MRInfo,
  AIContext,
} from './git.types';

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);
  private readonly username: string;

  constructor(
    private readonly gitLabService: GitLabService,
    configService: ConfigService,
  ) {
    this.username = configService.get('GITLAB_USERNAME') || '';
  }

  async getEvents(afterDate: Date): Promise<GitLabEvent[]> {
    return this.gitLabService.getEvents({
      after: afterDate.toISOString().split('T')[0],
    });
  }

  async getProjectNames(projectIds: number[]): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    await Promise.all(
      projectIds.map(async (id) => {
        try {
          const project = await this.gitLabService.getProject(id);
          names.set(id, project.name);
        } catch {
          names.set(id, GitMessages.PROJECT_NOT_FOUND(id));
        }
      }),
    );
    return names;
  }

  async getIssues(
    requests: { projectId: number; issueIid: number }[],
  ): Promise<Map<string, any>> {
    const issues = new Map<string, any>();
    const unique = this.unique(
      requests,
      (request) => `${request.projectId}-${request.issueIid}`,
    );

    await Promise.all(
      unique.map(async ({ projectId, issueIid }) => {
        const issue = await this.gitLabService.getIssue(projectId, issueIid);
        if (issue) issues.set(`${projectId}-${issueIid}`, issue);
      }),
    );
    return issues;
  }

  async getMergeRequests(
    requests: { projectId: number; mrIid: number }[],
  ): Promise<Map<string, GitLabMergeRequest>> {
    const mrs = new Map<string, GitLabMergeRequest>();
    const unique = this.unique(
      requests,
      (request) => `${request.projectId}-${request.mrIid}`,
    );

    await Promise.all(
      unique.map(async ({ projectId, mrIid }) => {
        const mr = await this.gitLabService.getMergeRequest(projectId, mrIid);
        if (mr) mrs.set(`${projectId}-${mrIid}`, mr);
      }),
    );
    return mrs;
  }

  async getMergeRequestsByBranches(
    requests: { projectId: number; sourceBranch: string }[],
  ): Promise<Map<string, GitLabMergeRequest>> {
    const mrs = new Map<string, GitLabMergeRequest>();
    const unique = this.unique(
      requests,
      (request) => `${request.projectId}-${request.sourceBranch}`,
    );

    await Promise.all(
      unique.map(async ({ projectId, sourceBranch }) => {
        const mr = await this.gitLabService.getMergeRequestByBranch(
          projectId,
          sourceBranch,
        );
        if (mr) mrs.set(`${projectId}-${mr.iid}`, mr);
      }),
    );
    return mrs;
  }

  async getCommentContexts(
    requests: { projectId: number; mrIid: number }[],
  ): Promise<Map<string, CommentContext>> {
    const contexts = new Map<string, CommentContext>();
    const unique = this.unique(
      requests,
      (request) => `${request.projectId}-${request.mrIid}`,
    );

    await Promise.all(
      unique.map(async ({ projectId, mrIid }) => {
        const notes = await this.gitLabService.getMergeRequestNotes(
          projectId,
          mrIid,
        );
        contexts.set(`${projectId}-${mrIid}`, this.analyzeComments(notes));
      }),
    );
    return contexts;
  }

  async getAIContexts(
    requests: { projectId: number; mrIid: number }[],
    date: Date,
  ): Promise<Map<string, AIContext>> {
    const contexts = new Map<string, AIContext>();
    const unique = this.unique(
      requests,
      (request) => `${request.projectId}-${request.mrIid}`,
    );
    const { start, end } = this.getDayBounds(date);

    await Promise.all(
      unique.map(async ({ projectId, mrIid }) => {
        const [commits, notes] = await Promise.all([
          this.gitLabService.getMergeRequestCommits(projectId, mrIid),
          this.gitLabService.getMergeRequestNotes(projectId, mrIid),
        ]);

        const commitMessages = commits
          .filter((commit) => {
            const commitDate = new Date(commit.authored_date);
            return commitDate >= start && commitDate <= end;
          })
          .map((commit) => commit.title);

        if (commits.length > 0 && commitMessages.length === 0) {
          this.logger.warn(
            `MR ${projectId}-${mrIid}: ${commits.length} commits total, 0 in range. Commit dates: ${commits
              .slice(0, 5)
              .map((c) => c.authored_date)
              .join(
                ', ',
              )}. Range: ${start.toISOString()} - ${end.toISOString()}`,
          );
        }
        if (commits.length === 0) {
          this.logger.warn(
            `MR ${projectId}-${mrIid}: GitLab returned 0 commits`,
          );
        }

        const comments = notes
          .filter((note) => {
            const noteDate = new Date(note.created_at);
            return (
              this.isMyUsername(note.author.username) &&
              noteDate >= start &&
              noteDate <= end
            );
          })
          .map((note) => note.body);

        contexts.set(`${projectId}-${mrIid}`, { commitMessages, comments });
      }),
    );
    return contexts;
  }

  getMRInfo(mr: GitLabMergeRequest): MRInfo | null {
    if (!this.username) return null;

    const assignees = mr.assignees || (mr.assignee ? [mr.assignee] : []);
    const reviewers = mr.reviewers || [];
    const labels = mr.labels || [];

    return {
      iid: mr.iid,
      isAuthor: this.isMyUsername(mr.author?.username),
      isAssignedToMe: assignees.some((assignee) =>
        this.isMyUsername(assignee?.username),
      ),
      isReviewer: reviewers.some((reviewer) =>
        this.isMyUsername(reviewer?.username),
      ),
      hasReviewLabel: labels.some((label) =>
        label.toLowerCase().includes(LabelStatus.REVIEW),
      ),
      createdAt: new Date(mr.created_at),
    };
  }

  analyzeMerges(events: GitLabEvent[]): MergeContext {
    const mergedBranches = new Set<string>();
    const acceptedMRs = new Set<number>();

    for (const event of events) {
      if (this.isMergeCommit(event)) {
        const branch = this.extractBranchFromMergeCommit(event);
        if (branch) mergedBranches.add(branch);
      }
    }

    for (const event of events) {
      if (this.isAcceptedMR(event)) {
        const hasMergeNearby = events.some(
          (otherEvent) =>
            this.isMergeCommit(otherEvent) &&
            Math.abs(
              new Date(otherEvent.created_at).getTime() -
                new Date(event.created_at).getTime(),
            ) < 2000,
        );
        if (hasMergeNearby && event.target_id) acceptedMRs.add(event.target_id);
      }
    }

    return { mergedBranches, acceptedMRs };
  }

  shouldSkipEvent(event: GitLabEvent, context: MergeContext): boolean {
    const { mergedBranches, acceptedMRs } = context;

    if (
      event.action_name === GitLabAction.DELETED &&
      event.push_data?.ref &&
      mergedBranches.has(event.push_data.ref)
    ) {
      return true;
    }

    if (this.isClosedIssue(event) && event.target_iid) {
      for (const branch of mergedBranches) {
        if (branch.includes(`${event.target_iid}-`)) return true;
      }
    }

    if (
      this.isAcceptedMR(event) &&
      event.target_id &&
      acceptedMRs.has(event.target_id)
    ) {
      return true;
    }

    return false;
  }

  extractTaskInfo(
    event: GitLabEvent,
    mrSourceBranches?: Map<string, string>,
  ): EventTaskInfo {
    const taskId =
      this.extractTaskIdFromPush(event) ||
      this.extractTaskIdFromTarget(event) ||
      this.extractTaskIdFromMR(event, mrSourceBranches) ||
      this.extractTaskIdFromNote(event, mrSourceBranches) ||
      this.extractTaskIdFromTitle(event);

    return {
      taskId,
      projectId: event.project_id,
      actionType: this.mapActionType(event),
    };
  }

  collectPushBranches(
    events: GitLabEvent[],
  ): { projectId: number; sourceBranch: string }[] {
    return events
      .filter((event) => this.isPushEvent(event) && event.push_data?.ref)
      .map((event) => ({
        projectId: event.project_id,
        sourceBranch: event.push_data!.ref,
      }));
  }

  collectMrRequests(
    events: GitLabEvent[],
  ): { projectId: number; mrIid: number }[] {
    const requests: { projectId: number; mrIid: number }[] = [];

    for (const event of events) {
      if (
        event.target_type === GitLabTargetType.MERGE_REQUEST &&
        event.target_iid
      ) {
        requests.push({ projectId: event.project_id, mrIid: event.target_iid });
      }
      if (
        event.note?.noteable_type === GitLabTargetType.MERGE_REQUEST &&
        event.note?.noteable_iid
      ) {
        requests.push({
          projectId: event.project_id,
          mrIid: event.note.noteable_iid,
        });
      }
    }

    return requests;
  }

  private analyzeComments(notes: GitLabNote[]): CommentContext {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let myCommentsCount = 0;
    let otherCommentsCount = 0;
    let iReplied = false;
    let hadMyCommentsBefore = false;

    for (const note of notes) {
      const isMyComment = this.isMyUsername(note.author.username);
      const commentDate = new Date(note.created_at);

      if (isMyComment) {
        myCommentsCount++;
        if (otherCommentsCount > 0) iReplied = true;
        if (commentDate < today) hadMyCommentsBefore = true;
      } else {
        otherCommentsCount++;
      }
    }

    return {
      hasOtherComments: otherCommentsCount > 0,
      iReplied,
      myCommentsCount,
      otherCommentsCount,
      hadMyCommentsBefore,
    };
  }

  private mapActionType(event: GitLabEvent): TaskAction {
    const action = event.action_name;
    const targetType = event.target_type;

    if (action === GitLabAction.PUSHED_NEW) {
      return event.push_data?.ref_type === 'branch'
        ? TaskAction.CREATED_BRANCH
        : TaskAction.OTHER;
    }

    if (action === GitLabAction.OPENED) {
      if (targetType === GitLabTargetType.MERGE_REQUEST)
        return TaskAction.OPENED_MR;
      if (this.isIssueType(targetType)) return TaskAction.OPENED_ISSUE;
      return TaskAction.OTHER;
    }

    if (action === GitLabAction.PUSHED_TO) {
      if (this.isMergeCommit(event)) {
        const ref = event.push_data?.ref || '';
        return this.isMainBranch(ref) ? TaskAction.MERGED : TaskAction.PUSH;
      }
      return TaskAction.PUSH;
    }

    if (action === GitLabAction.APPROVED) return TaskAction.APPROVED_MR;
    if (action === GitLabAction.ACCEPTED) return TaskAction.ACCEPTED_MR;
    if (action === GitLabAction.MERGED) return TaskAction.MERGED;

    if (action === GitLabAction.COMMENTED_ON) {
      return event.note?.noteable_type === GitLabTargetType.MERGE_REQUEST
        ? TaskAction.COMMENT_MR
        : TaskAction.COMMENT_ISSUE;
    }

    if (action === GitLabAction.CLOSED && this.isIssueType(targetType)) {
      return TaskAction.CLOSED_ISSUE;
    }

    return TaskAction.OTHER;
  }

  private extractTaskIdFromPush(event: GitLabEvent): number | null {
    if (event.push_data?.ref) {
      const id = this.parseTaskId(event.push_data.ref);
      if (id) return id;
    }

    if (event.push_data?.commit_title) {
      const match = event.push_data.commit_title.match(GitPattern.MERGE_BRANCH);
      if (match) return this.parseTaskId(match[1]);
    }

    return null;
  }

  private extractTaskIdFromTarget(event: GitLabEvent): number | null {
    if (this.isIssueType(event.target_type)) {
      return event.target_iid || null;
    }
    return null;
  }

  private extractTaskIdFromMR(
    event: GitLabEvent,
    mrSourceBranches?: Map<string, string>,
  ): number | null {
    if (
      event.target_type === GitLabTargetType.MERGE_REQUEST &&
      mrSourceBranches
    ) {
      const branch = mrSourceBranches.get(
        `${event.project_id}-${event.target_iid}`,
      );
      if (branch) return this.parseTaskId(branch);
    }
    return null;
  }

  private extractTaskIdFromNote(
    event: GitLabEvent,
    mrSourceBranches?: Map<string, string>,
  ): number | null {
    if (!event.note) return null;

    if (
      event.note.noteable_type === GitLabTargetType.MERGE_REQUEST &&
      mrSourceBranches
    ) {
      const branch = mrSourceBranches.get(
        `${event.project_id}-${event.note.noteable_iid}`,
      );
      if (branch) return this.parseTaskId(branch);
    }

    if (this.isIssueType(event.note.noteable_type)) {
      return event.note.noteable_iid || null;
    }

    return null;
  }

  private extractTaskIdFromTitle(event: GitLabEvent): number | null {
    if (
      event.target_type === GitLabTargetType.MERGE_REQUEST &&
      event.target_title
    ) {
      const match = event.target_title.match(GitPattern.TASK_ID_FROM_TITLE);
      if (match) return parseInt(match[1], 10);
    }
    return null;
  }

  private parseTaskId(branchName: string): number | null {
    const match = branchName.match(GitPattern.TASK_ID_FROM_BRANCH);
    return match ? parseInt(match[1], 10) : null;
  }

  private isMergeCommit(event: GitLabEvent): boolean {
    return (
      event.action_name === GitLabAction.PUSHED_TO &&
      event.push_data?.commit_title?.includes('Merge branch') === true
    );
  }

  private extractBranchFromMergeCommit(event: GitLabEvent): string | null {
    const match = event.push_data?.commit_title?.match(GitPattern.MERGE_BRANCH);
    return match ? match[1] : null;
  }

  private isAcceptedMR(event: GitLabEvent): boolean {
    return (
      event.action_name === GitLabAction.ACCEPTED &&
      event.target_type === GitLabTargetType.MERGE_REQUEST
    );
  }

  private isClosedIssue(event: GitLabEvent): boolean {
    return (
      (event.action_name === GitLabAction.CLOSED ||
        event.action_name === GitLabAction.ACCEPTED) &&
      this.isIssueType(event.target_type)
    );
  }

  private isPushEvent(event: GitLabEvent): boolean {
    return (
      event.action_name === GitLabAction.PUSHED_TO ||
      event.action_name === GitLabAction.PUSHED_NEW
    );
  }

  private isIssueType(type: string | null | undefined): boolean {
    return (
      type === GitLabTargetType.ISSUE || type === GitLabTargetType.WORK_ITEM
    );
  }

  private isMainBranch(ref: string): boolean {
    return Object.values(MainBranch).includes(ref as MainBranch);
  }

  private isMyUsername(username: string | undefined): boolean {
    return username?.toLowerCase() === this.username.toLowerCase();
  }

  private getDayBounds(date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private unique<T>(arr: T[], keyFn: (item: T) => string): T[] {
    return Array.from(new Map(arr.map((item) => [keyFn(item), item])).values());
  }
}
