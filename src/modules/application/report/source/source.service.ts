import { Injectable } from '@nestjs/common';
import { getDayRange, isWithinDay } from 'src/common/utils/date.util';
import {
  GitLabIssuable,
  GitLabTargetType,
} from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabEvent,
  GitLabIssue,
  GitLabMergeRequest,
  GitLabProject,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import {
  SOURCE_BRANCH_ISSUE_PATTERN,
  SOURCE_ISSUE_TARGET_TYPES,
  SOURCE_KEY_SEPARATOR,
  SOURCE_MAIN_BRANCHES,
} from './constants/source.constants';
import { SourceBuilder } from './source.builder';
import type {
  DayActivity,
  IssueActivity,
  MergeRequestActivity,
  SourceBranch,
  SourceEventGroups,
  SourceEvents,
  SourceItem,
} from './source.interface';

@Injectable()
export class SourceService {
  constructor(
    private readonly gitlabService: GitLabService,
    private readonly sourceBuilder: SourceBuilder,
  ) {}

  async collect(gitlabUserId: number, date: string, timeZone: string) {
    const day = getDayRange(date, timeZone);
    const events = await this.gitlabService.findUserEventsAround(
      gitlabUserId,
      date,
    );
    const groups = this.groupEvents(
      events.filter((event) => isWithinDay(event.created_at, day)),
    );
    const projects = await this.loadProjects(groups);
    const mergeRequests = await this.loadMergeRequests(groups, projects);
    const issues = await this.loadIssues(groups, mergeRequests);
    const activity = await this.loadActivity(
      groups,
      projects,
      issues,
      mergeRequests,
    );
    return this.sourceBuilder.build(activity, day);
  }

  private groupEvents(events: GitLabEvent[]): SourceEventGroups {
    const groups: SourceEventGroups = {
      issues: new Map(),
      mergeRequests: new Map(),
      pushes: new Map(),
    };
    for (const event of events) {
      const projectId = event.project_id;
      if (projectId === null) {
        continue;
      }
      const type = event.note?.noteable_type ?? event.target_type;
      const iid = event.note?.noteable_iid ?? event.target_iid;
      const branch = event.push_data?.ref;
      if (
        iid !== null &&
        type !== null &&
        SOURCE_ISSUE_TARGET_TYPES.has(type)
      ) {
        this.addEvent(groups.issues, { projectId, iid }, event);
      } else if (iid !== null && type === GitLabTargetType.MERGE_REQUEST) {
        this.addEvent(groups.mergeRequests, { projectId, iid }, event);
      } else if (branch) {
        this.addEvent(groups.pushes, { projectId, branch }, event);
      }
    }
    return groups;
  }

  private async loadProjects(groups: SourceEventGroups) {
    const projectIds = new Set(
      [
        ...groups.issues.values(),
        ...groups.mergeRequests.values(),
        ...groups.pushes.values(),
      ].map(({ target }) => target.projectId),
    );
    const projects = await Promise.all(
      [...projectIds].map((projectId) =>
        this.gitlabService.findProject(projectId),
      ),
    );
    return new Map(
      projects
        .filter((project) => project !== null)
        .map((project) => [project.id, project]),
    );
  }

  private async loadMergeRequests(
    groups: SourceEventGroups,
    projects: Map<number, GitLabProject>,
  ) {
    const fromEvents = await Promise.all(
      [...groups.mergeRequests.values()].map(({ target }) =>
        this.gitlabService.findMergeRequest(target.projectId, target.iid),
      ),
    );
    const mergeRequests = new Map(
      fromEvents
        .filter((mergeRequest) => mergeRequest !== null)
        .map((mergeRequest) => [this.toItemKey(mergeRequest), mergeRequest]),
    );

    const branches = new Set(
      [...mergeRequests.values()].map((mergeRequest) =>
        this.toBranchKey(mergeRequest),
      ),
    );
    const fromBranches = await Promise.all(
      [...groups.pushes]
        .filter(
          ([key, { target }]) =>
            !branches.has(key) && this.isWorkBranch(target, projects),
        )
        .map(([, { target }]) =>
          this.gitlabService.findMergeRequestByBranch(
            target.projectId,
            target.branch,
          ),
        ),
    );
    for (const mergeRequest of fromBranches.filter((item) => item !== null)) {
      const key = this.toItemKey(mergeRequest);
      if (!groups.mergeRequests.has(key)) {
        mergeRequests.set(key, mergeRequest);
      }
    }
    return mergeRequests;
  }

  private async loadIssues(
    groups: SourceEventGroups,
    mergeRequests: Map<string, GitLabMergeRequest>,
  ) {
    const targets = new Map(
      [...groups.issues].map(([key, { target }]) => [key, target]),
    );
    for (const mergeRequest of mergeRequests.values()) {
      const target = this.toBranchIssue(mergeRequest);
      if (target) {
        targets.set(this.toKey(target), target);
      }
    }
    const issues = await Promise.all(
      [...targets.values()].map(({ projectId, iid }) =>
        this.gitlabService.findIssue(projectId, iid),
      ),
    );
    return new Map(
      issues
        .filter((issue) => issue !== null)
        .map((issue) => [this.toItemKey(issue), issue]),
    );
  }

  private async loadActivity(
    groups: SourceEventGroups,
    projects: Map<number, GitLabProject>,
    issues: Map<string, GitLabIssue>,
    mergeRequests: Map<string, GitLabMergeRequest>,
  ): Promise<DayActivity> {
    const branchMergeRequests = new Map<string, string>();
    for (const [key, mergeRequest] of mergeRequests) {
      const branchKey = this.toBranchKey(mergeRequest);
      if (!branchMergeRequests.has(branchKey)) {
        branchMergeRequests.set(branchKey, key);
      }
    }

    const issueActivities = new Map(
      await Promise.all(
        [...issues].map(
          async ([key, issue]) =>
            [
              key,
              await this.loadIssueActivity(
                issue,
                groups.issues.get(key)?.events ?? [],
              ),
            ] as const,
        ),
      ),
    );
    const mergeRequestActivities = await Promise.all(
      [...mergeRequests].map(([key, mergeRequest]) => {
        const branchKey = this.toBranchKey(mergeRequest);
        const pushes =
          branchMergeRequests.get(branchKey) === key
            ? (groups.pushes.get(branchKey)?.events ?? [])
            : [];
        return this.loadMergeRequestActivity(mergeRequest, [
          ...(groups.mergeRequests.get(key)?.events ?? []),
          ...pushes,
        ]);
      }),
    );

    const standaloneMergeRequests: MergeRequestActivity[] = [];
    for (const activity of mergeRequestActivities) {
      const target = this.toBranchIssue(activity.mergeRequest);
      const issue = target && issueActivities.get(this.toKey(target));
      if (issue) {
        issue.mergeRequests.push(activity);
      } else {
        standaloneMergeRequests.push(activity);
      }
    }

    return {
      projects: [...projects.values()],
      issues: [...issueActivities.values()],
      mergeRequests: standaloneMergeRequests,
      pushes: [...groups.pushes]
        .filter(
          ([key, { target }]) =>
            !branchMergeRequests.has(key) &&
            this.isWorkBranch(target, projects),
        )
        .map(([, push]) => push),
    };
  }

  private async loadIssueActivity(
    issue: GitLabIssue,
    events: GitLabEvent[],
  ): Promise<IssueActivity> {
    const { project_id: projectId, iid } = issue;
    const [notes, labelEvents, stateEvents] = await Promise.all([
      this.gitlabService.findNotes(GitLabIssuable.ISSUES, projectId, iid),
      this.gitlabService.findLabelEvents(GitLabIssuable.ISSUES, projectId, iid),
      this.gitlabService.findStateEvents(GitLabIssuable.ISSUES, projectId, iid),
    ]);
    return {
      issue,
      events,
      notes,
      labelEvents,
      stateEvents,
      mergeRequests: [],
    };
  }

  private async loadMergeRequestActivity(
    mergeRequest: GitLabMergeRequest,
    events: GitLabEvent[],
  ): Promise<MergeRequestActivity> {
    const { project_id: projectId, iid } = mergeRequest;
    const issuable = GitLabIssuable.MERGE_REQUESTS;
    const [notes, labelEvents, stateEvents, commits] = await Promise.all([
      this.gitlabService.findNotes(issuable, projectId, iid),
      this.gitlabService.findLabelEvents(issuable, projectId, iid),
      this.gitlabService.findStateEvents(issuable, projectId, iid),
      this.gitlabService.findMergeRequestCommits(projectId, iid),
    ]);
    return { mergeRequest, events, notes, labelEvents, stateEvents, commits };
  }

  private addEvent<T extends SourceItem | SourceBranch>(
    groups: Map<string, SourceEvents<T>>,
    target: T,
    event: GitLabEvent,
  ) {
    const key = this.toKey(target);
    const group = groups.get(key) ?? { target, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }

  private isWorkBranch(
    { projectId, branch }: SourceBranch,
    projects: Map<number, GitLabProject>,
  ) {
    return (
      !SOURCE_MAIN_BRANCHES.has(branch) &&
      projects.get(projectId)?.default_branch !== branch
    );
  }

  private toBranchIssue(mergeRequest: GitLabMergeRequest): SourceItem | null {
    const match = SOURCE_BRANCH_ISSUE_PATTERN.exec(mergeRequest.source_branch);
    return match
      ? { projectId: mergeRequest.project_id, iid: Number(match[1]) }
      : null;
  }

  private toItemKey(item: GitLabIssue | GitLabMergeRequest) {
    return this.toKey({ projectId: item.project_id, iid: item.iid });
  }

  private toBranchKey(mergeRequest: GitLabMergeRequest) {
    return this.toKey({
      projectId: mergeRequest.project_id,
      branch: mergeRequest.source_branch,
    });
  }

  private toKey(target: SourceItem | SourceBranch) {
    return [
      target.projectId,
      'iid' in target ? target.iid : target.branch,
    ].join(SOURCE_KEY_SEPARATOR);
  }
}
