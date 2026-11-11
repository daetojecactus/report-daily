import { Injectable } from '@nestjs/common';
import type { UserSource } from 'src/modules/application/user/user-source/types/user-source.interface';
import { getDayRange, isWithinDay } from 'src/common/utils/date.util';
import type {
  GitLabIssue,
  GitLabMergeRequest,
  GitLabProject,
} from 'src/modules/vendors/gitlab/types/gitlab.interface';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import { Source } from '../types/source.enums';
import type { ActivitySource } from '../types/source.interface';
import { GitLabSourceBuilder } from './gitlab-source.builder';
import { GitLabSourceDetails } from './gitlab-source.details';
import type { SourceEventGroups, SourceItem, SourceLinks } from './types/gitlab-source.interface';
import { GitLabSourceEvents } from './gitlab-source.events';
import { GitLabSourceKeys } from './gitlab-source.keys';
import { GitLabSourceLinks } from './gitlab-source.links';
import { GitLabSourceScanner } from './gitlab-source.scanner';

@Injectable()
export class GitLabSourceService implements ActivitySource {
  readonly source = Source.GITLAB;

  constructor(
    private readonly gitlabService: GitLabService,
    private readonly gitlabSourceBuilder: GitLabSourceBuilder,
    private readonly gitlabSourceScanner: GitLabSourceScanner,
    private readonly gitlabSourceDetails: GitLabSourceDetails,
    private readonly gitlabSourceKeys: GitLabSourceKeys,
    private readonly gitlabSourceLinks: GitLabSourceLinks,
    private readonly gitlabSourceEvents: GitLabSourceEvents,
  ) {}

  async collect(account: UserSource, date: string, timeZone: string) {
    const gitlabUserId = Number(account.externalId);
    const day = getDayRange(date, timeZone);
    const [events, hidden] = await Promise.all([
      this.gitlabService.findUserEventsAround(gitlabUserId, date),
      this.gitlabSourceScanner.findHiddenItems(gitlabUserId, date, day),
    ]);
    const groups = this.gitlabSourceEvents.group(
      events.filter((event) => isWithinDay(event.created_at, day)),
    );
    for (const target of hidden.issues) {
      this.gitlabSourceEvents.addTarget(groups.issues, target);
    }
    for (const target of hidden.mergeRequests) {
      this.gitlabSourceEvents.addTarget(groups.mergeRequests, target);
    }
    const projects = await this.loadProjects(
      [
        ...groups.issues.values(),
        ...groups.mergeRequests.values(),
        ...groups.pushes.values(),
        ...groups.refs.values(),
        ...groups.targets.values(),
      ].map(({ target }) => target.projectId),
    );
    const mergeRequests = await this.loadMergeRequests(groups, projects);
    const closingIssues = await this.loadClosingIssues(mergeRequests);
    const pushIssues = this.findPushIssues(groups, mergeRequests, projects);
    const links = this.linkMergeRequests(
      mergeRequests,
      await this.loadIssues(groups, mergeRequests, closingIssues, pushIssues),
      closingIssues,
      pushIssues,
    );
    const linkedProjects = await this.loadProjects(
      [...links.issues.values()]
        .map((issue) => issue.project_id)
        .filter((projectId) => !projects.has(projectId)),
    );
    const activity = await this.gitlabSourceLinks.addSources(
      await this.gitlabSourceDetails.load(
        groups,
        new Map([...projects, ...linkedProjects]),
        mergeRequests,
        closingIssues,
        links,
      ),
      gitlabUserId,
      day,
    );
    return this.gitlabSourceBuilder.build(activity, day, {
      id: gitlabUserId,
      username: account.username,
    });
  }

  private async loadProjects(projectIds: number[]) {
    const projects = await Promise.all(
      [...new Set(projectIds)].map((projectId) => this.gitlabService.findProject(projectId)),
    );
    return new Map(
      projects.filter((project) => project !== null).map((project) => [project.id, project]),
    );
  }

  private async loadMergeRequests(groups: SourceEventGroups, projects: Map<number, GitLabProject>) {
    const fromEvents = await Promise.all(
      [...groups.mergeRequests.values()].map(({ target }) =>
        this.gitlabService.findMergeRequest(target.projectId, target.iid),
      ),
    );
    const mergeRequests = new Map(
      fromEvents
        .filter((mergeRequest) => mergeRequest !== null)
        .map((mergeRequest) => [this.gitlabSourceKeys.toItemKey(mergeRequest), mergeRequest]),
    );

    const branches = new Set(
      [...mergeRequests.values()].map((mergeRequest) =>
        this.gitlabSourceKeys.toBranchKey(mergeRequest),
      ),
    );
    const fromBranches = await Promise.all(
      [...groups.pushes]
        .filter(
          ([key, { target }]) =>
            !branches.has(key) && this.gitlabSourceKeys.isWorkBranch(target, projects),
        )
        .map(([, { target }]) =>
          this.gitlabService.findMergeRequestByBranch(target.projectId, target.branch),
        ),
    );
    for (const mergeRequest of fromBranches.filter((item) => item !== null)) {
      const key = this.gitlabSourceKeys.toItemKey(mergeRequest);
      if (!groups.mergeRequests.has(key)) {
        mergeRequests.set(key, mergeRequest);
      }
    }
    return mergeRequests;
  }

  private async loadClosingIssues(mergeRequests: Map<string, GitLabMergeRequest>) {
    return new Map(
      await Promise.all(
        [...mergeRequests].map(
          async ([key, mergeRequest]) =>
            [
              key,
              await this.gitlabService.findIssuesClosedOnMerge(
                mergeRequest.project_id,
                mergeRequest.iid,
              ),
            ] as const,
        ),
      ),
    );
  }

  private findPushIssues(
    groups: SourceEventGroups,
    mergeRequests: Map<string, GitLabMergeRequest>,
    projects: Map<number, GitLabProject>,
  ) {
    const branches = new Set(
      [...mergeRequests.values()].map((mergeRequest) =>
        this.gitlabSourceKeys.toBranchKey(mergeRequest),
      ),
    );
    const pushIssues = new Map<string, SourceItem>();
    for (const [key, { target }] of groups.pushes) {
      const issue = this.gitlabSourceKeys.toIssueOfBranch(target);
      if (issue && !branches.has(key) && this.gitlabSourceKeys.isWorkBranch(target, projects)) {
        pushIssues.set(key, issue);
      }
    }
    return pushIssues;
  }

  private async loadIssues(
    groups: SourceEventGroups,
    mergeRequests: Map<string, GitLabMergeRequest>,
    closingIssues: Map<string, GitLabIssue[]>,
    pushIssues: Map<string, SourceItem>,
  ) {
    const known = new Map(
      [...closingIssues.values()]
        .flat()
        .map((issue) => [this.gitlabSourceKeys.toItemKey(issue), issue]),
    );
    const targets = new Map([...groups.issues].map(([key, { target }]) => [key, target]));
    for (const mergeRequest of mergeRequests.values()) {
      const branchIssue = this.gitlabSourceKeys.toBranchIssue(mergeRequest);
      if (branchIssue) {
        targets.set(this.gitlabSourceKeys.toKey(branchIssue), branchIssue);
      }
    }
    for (const issue of pushIssues.values()) {
      targets.set(this.gitlabSourceKeys.toKey(issue), issue);
    }
    const issues = await Promise.all(
      [...targets].map(async ([key, { projectId, iid }]) => {
        const issue = known.get(key) ?? (await this.gitlabService.findIssue(projectId, iid));
        return issue ? [[key, issue] as const] : [];
      }),
    );
    return new Map(issues.flat());
  }

  private linkMergeRequests(
    mergeRequests: Map<string, GitLabMergeRequest>,
    issues: Map<string, GitLabIssue>,
    closingIssues: Map<string, GitLabIssue[]>,
    pushIssues: Map<string, SourceItem>,
  ) {
    const links: SourceLinks = {
      issues: new Map(issues),
      mainIssues: new Map(),
      pushIssues: new Map(),
    };
    for (const [branchKey, issue] of pushIssues) {
      const issueKey = this.gitlabSourceKeys.toKey(issue);
      if (issues.has(issueKey)) {
        links.pushIssues.set(branchKey, issueKey);
      }
    }
    for (const [key, mergeRequest] of mergeRequests) {
      const branchIssue = this.gitlabSourceKeys.toBranchIssue(mergeRequest);
      const branchKey = branchIssue && this.gitlabSourceKeys.toKey(branchIssue);
      const closing = closingIssues.get(key) ?? [];
      if (branchKey && links.issues.has(branchKey)) {
        links.mainIssues.set(key, branchKey);
      } else if (closing.length === 1) {
        const issueKey = this.gitlabSourceKeys.toItemKey(closing[0]);
        links.issues.set(issueKey, links.issues.get(issueKey) ?? closing[0]);
        links.mainIssues.set(key, issueKey);
      }
    }
    return links;
  }
}
