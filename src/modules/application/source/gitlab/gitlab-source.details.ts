import { Injectable } from '@nestjs/common';
import { GitLabIssuable } from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabEvent,
  GitLabIssue,
  GitLabMergeRequest,
  GitLabProject,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import type {
  DayActivity,
  IssueActivity,
  MergeRequestActivity,
  SourceEventGroups,
  SourceLinks,
} from './gitlab-source.interface';
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
    const branchMergeRequests = new Map<string, string>();
    for (const [key, mergeRequest] of mergeRequests) {
      const branchKey = this.gitlabSourceKeys.toBranchKey(mergeRequest);
      if (!branchMergeRequests.has(branchKey)) {
        branchMergeRequests.set(branchKey, key);
      }
    }

    const [issueEntries, mergeRequestActivities, pushCommits] = await Promise.all([
      Promise.all(
        [...links.issues].map(
          async ([key, issue]) =>
            [
              key,
              await this.loadIssueActivity(issue, groups.issues.get(key)?.events ?? []),
            ] as const,
        ),
      ),
      Promise.all(
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
      ),
      this.loadPushCommits(groups),
    ]);
    const issueActivities = new Map(issueEntries);

    const standaloneMergeRequests: MergeRequestActivity[] = [];
    for (const [key, activity] of mergeRequestActivities) {
      const mainIssue = links.mainIssues.get(key);
      const issue = mainIssue && issueActivities.get(mainIssue);
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
            !branchMergeRequests.has(key) && this.gitlabSourceKeys.isWorkBranch(target, projects),
        )
        .map(([, push]) => push),
      pushCommits,
    };
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
    closingIssues: GitLabIssue[],
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
    return {
      mergeRequest,
      closingIssues,
      events,
      notes,
      labelEvents,
      stateEvents,
      commits,
    };
  }
}
