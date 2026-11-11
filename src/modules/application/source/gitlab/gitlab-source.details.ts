import { Injectable } from '@nestjs/common';
import { GitLabIssuable } from 'src/modules/vendors/gitlab/types/gitlab.enums';
import type { GitLabEvent } from 'src/modules/vendors/gitlab/types/gitlab-event.interface';
import type {
  GitLabIssue,
  GitLabIteration,
  GitLabMergeRequest,
  GitLabMilestone,
} from 'src/modules/vendors/gitlab/types/gitlab-issue.interface';
import type { GitLabMilestoneEvent } from 'src/modules/vendors/gitlab/types/gitlab-history.interface';
import type { GitLabProject } from 'src/modules/vendors/gitlab/types/gitlab.interface';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import { GITLAB_SOURCE_ITERATION_DATES_SEPARATOR } from './constants/gitlab-source-keys.constants';
import type {
  DayActivity,
  IssueActivity,
  MergeRequestActivity,
  SourceBranch,
  SourceEventGroups,
  SourceEvents,
  SourceLinks,
  SourcePlanHistory,
} from './types/gitlab-source.interface';
import { GitLabSourceKeys } from './gitlab-source.keys';

@Injectable()
export class GitLabSourceDetails {
  constructor(
    private readonly gitlabService: GitLabService,
    private readonly gitlabSourceKeys: GitLabSourceKeys,
  ) {}

  async load(
    groups: SourceEventGroups,
    projects: Map<number, GitLabProject>,
    mergeRequests: Map<string, GitLabMergeRequest>,
    closingIssues: Map<string, GitLabIssue[]>,
    links: SourceLinks,
  ): Promise<DayActivity> {
    const branchMergeRequests = this.indexBranchMergeRequests(mergeRequests);
    const [issues, mergeRequestActivities, pushCommits] = await Promise.all([
      this.loadIssues(groups, links),
      this.loadMergeRequests(groups, mergeRequests, closingIssues, branchMergeRequests),
      this.loadPushCommits(groups),
    ]);
    return {
      projects: [...projects.values()],
      issues: [...issues.values()],
      mergeRequests: this.attachToIssues(mergeRequestActivities, issues, links),
      pushes: [...groups.pushes]
        .filter(
          ([key, { target }]) =>
            !branchMergeRequests.has(key) &&
            !links.pushIssues.has(key) &&
            this.gitlabSourceKeys.isWorkBranch(target, projects),
        )
        .map(([, push]) => push),
      directPushes: [...groups.pushes.values()]
        .filter(({ target }) => !this.gitlabSourceKeys.isWorkBranch(target, projects))
        .map(({ target, events }) => ({
          target,
          events: events.filter((event) => !this.isMergePush(event, target, mergeRequests)),
        }))
        .filter(({ events }) => events.length),
      refs: [...groups.refs.values()],
      targets: [...groups.targets.values()],
      pushCommits,
    };
  }

  private indexBranchMergeRequests(mergeRequests: Map<string, GitLabMergeRequest>) {
    const branchMergeRequests = new Map<string, string>();
    for (const [key, mergeRequest] of mergeRequests) {
      const branchKey = this.gitlabSourceKeys.toBranchKey(mergeRequest);
      if (!branchMergeRequests.has(branchKey)) {
        branchMergeRequests.set(branchKey, key);
      }
    }
    return branchMergeRequests;
  }

  private async loadIssues(groups: SourceEventGroups, links: SourceLinks) {
    const entries = await Promise.all(
      [...links.issues].map(async ([key, issue]) => {
        const pushes = [...links.pushIssues]
          .filter(([, issueKey]) => issueKey === key)
          .flatMap(([branchKey]) => groups.pushes.get(branchKey) ?? []);
        const events = groups.issues.get(key)?.events ?? [];
        return [key, await this.loadIssueActivity(issue, events, pushes)] as const;
      }),
    );
    return new Map(entries);
  }

  private loadMergeRequests(
    groups: SourceEventGroups,
    mergeRequests: Map<string, GitLabMergeRequest>,
    closingIssues: Map<string, GitLabIssue[]>,
    branchMergeRequests: Map<string, string>,
  ) {
    return Promise.all(
      [...mergeRequests].map(async ([key, mergeRequest]) => {
        const branchKey = this.gitlabSourceKeys.toBranchKey(mergeRequest);
        const pushes =
          branchMergeRequests.get(branchKey) === key
            ? (groups.pushes.get(branchKey)?.events ?? [])
            : [];
        const activity = await this.loadMergeRequestActivity(
          mergeRequest,
          closingIssues.get(key) ?? [],
          [...(groups.mergeRequests.get(key)?.events ?? []), ...pushes],
        );
        return [key, activity] as const;
      }),
    );
  }

  private attachToIssues(
    mergeRequestActivities: (readonly [string, MergeRequestActivity])[],
    issues: Map<string, IssueActivity>,
    links: SourceLinks,
  ) {
    const standaloneMergeRequests: MergeRequestActivity[] = [];
    for (const [key, activity] of mergeRequestActivities) {
      const mainIssue = links.mainIssues.get(key);
      const issue = mainIssue && issues.get(mainIssue);
      if (issue) {
        issue.mergeRequests.push(activity);
      } else {
        standaloneMergeRequests.push(activity);
      }
    }
    return standaloneMergeRequests;
  }

  private isMergePush(
    event: GitLabEvent,
    target: SourceBranch,
    mergeRequests: Map<string, GitLabMergeRequest>,
  ) {
    const commit = event.push_data?.commit_to ?? null;
    return (
      commit !== null &&
      [...mergeRequests.values()].some(
        (mergeRequest) =>
          mergeRequest.project_id === target.projectId &&
          mergeRequest.target_branch === target.branch &&
          [
            mergeRequest.merge_commit_sha,
            mergeRequest.squash_commit_sha,
            mergeRequest.sha,
          ].includes(commit),
      )
    );
  }

  private async loadPushCommits(groups: SourceEventGroups) {
    const pushes = [...groups.pushes.values()].flatMap(({ target, events }) =>
      events.flatMap((event) =>
        event.push_data
          ? [
              {
                projectId: target.projectId,
                id: event.id,
                push: event.push_data,
              },
            ]
          : [],
      ),
    );
    return new Map(
      await Promise.all(
        pushes.map(
          async ({ projectId, id, push }) =>
            [id, await this.gitlabService.findPushCommits(projectId, push)] as const,
        ),
      ),
    );
  }

  async loadIssueActivity(
    issue: GitLabIssue,
    events: GitLabEvent[],
    pushes: SourceEvents<SourceBranch>[],
  ): Promise<IssueActivity> {
    const { project_id: projectId, iid } = issue;
    const issuable = GitLabIssuable.ISSUES;
    const [notes, labelEvents, stateEvents, milestoneEvents, iterationEvents, weightEvents] =
      await Promise.all([
        this.gitlabService.findNotes(issuable, projectId, iid),
        this.gitlabService.findLabelEvents(issuable, projectId, iid),
        this.gitlabService.findStateEvents(issuable, projectId, iid),
        this.gitlabService.findMilestoneEvents(issuable, projectId, iid),
        this.gitlabService.findIterationEvents(projectId, iid),
        this.gitlabService.findWeightEvents(projectId, iid),
      ]);
    return {
      issue,
      events,
      notes,
      labelEvents,
      stateEvents,
      milestones: this.toMilestones(issue.milestone, milestoneEvents),
      iterations: {
        current: issue.iteration ? this.toIterationName(issue.iteration) : null,
        events: iterationEvents.flatMap(({ iteration, ...event }) =>
          iteration ? [{ ...event, name: this.toIterationName(iteration) }] : [],
        ),
      },
      weightEvents,
      mergeRequests: [],
      pushes,
    };
  }

  private async loadMergeRequestActivity(
    mergeRequest: GitLabMergeRequest,
    closingIssues: GitLabIssue[],
    events: GitLabEvent[],
  ): Promise<MergeRequestActivity> {
    const { project_id: projectId, iid } = mergeRequest;
    const issuable = GitLabIssuable.MERGE_REQUESTS;
    const [notes, labelEvents, stateEvents, milestoneEvents, commits] = await Promise.all([
      this.gitlabService.findNotes(issuable, projectId, iid),
      this.gitlabService.findLabelEvents(issuable, projectId, iid),
      this.gitlabService.findStateEvents(issuable, projectId, iid),
      this.gitlabService.findMilestoneEvents(issuable, projectId, iid),
      this.gitlabService.findMergeRequestCommits(projectId, iid),
    ]);
    return {
      mergeRequest,
      closingIssues,
      events,
      notes,
      labelEvents,
      stateEvents,
      milestones: this.toMilestones(mergeRequest.milestone, milestoneEvents),
      commits,
    };
  }

  private toMilestones(
    current: GitLabMilestone | null | undefined,
    events: GitLabMilestoneEvent[],
  ): SourcePlanHistory {
    return {
      current: current?.title ?? null,
      events: events.flatMap(({ milestone, ...event }) =>
        milestone ? [{ ...event, name: milestone.title }] : [],
      ),
    };
  }

  private toIterationName({ title, start_date: start, due_date: due }: GitLabIteration) {
    return title ?? `${start}${GITLAB_SOURCE_ITERATION_DATES_SEPARATOR}${due}`;
  }
}
