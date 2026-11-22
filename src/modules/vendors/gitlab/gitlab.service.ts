import { Injectable } from '@nestjs/common';
import { addDays } from 'src/common/utils/date.util';
import {
  GITLAB_EVENTS_MARGIN_DAYS,
  GITLAB_NOTES_PER_QUERY,
  GITLAB_PAGE_SIZE,
} from './constants/gitlab.constants';
import type { GitLabIssuable } from './types/gitlab.enums';
import type { GitLabPushData } from './types/gitlab-event.interface';
import type { GitLabPushCommits } from './types/gitlab.interface';
import { GitLabRepository } from './gitlab.repository';

@Injectable()
export class GitLabService {
  constructor(private readonly gitlabRepository: GitLabRepository) {}

  searchUsers(search: string) {
    return this.gitlabRepository.searchUsers(search);
  }

  findUser(id: number) {
    return this.gitlabRepository.findUser(id);
  }

  async hasVisibleActivity(userId: number) {
    return (await this.gitlabRepository.findLastUserEvent(userId)) !== null;
  }

  async findLastActivityAt(userId: number) {
    return (await this.gitlabRepository.findLastUserEvent(userId))?.created_at ?? null;
  }

  async findRecentProjectIds(userId: number, date: string, days: number) {
    const events = await this.gitlabRepository.findUserEvents(
      userId,
      addDays(date, -days),
      addDays(date, GITLAB_EVENTS_MARGIN_DAYS),
    );
    return [
      ...new Set(events.flatMap((event) => (event.project_id === null ? [] : [event.project_id]))),
    ];
  }

  findUserEventsAround(userId: number, date: string) {
    return this.gitlabRepository.findUserEvents(
      userId,
      addDays(date, -GITLAB_EVENTS_MARGIN_DAYS),
      addDays(date, GITLAB_EVENTS_MARGIN_DAYS),
    );
  }

  findProject(projectId: number) {
    return this.gitlabRepository.findProject(projectId);
  }

  findProjectByPath(path: string) {
    return this.gitlabRepository.findProjectByPath(path);
  }

  findIssue(projectId: number, iid: number) {
    return this.gitlabRepository.findIssue(projectId, iid);
  }

  findMergeRequest(projectId: number, iid: number) {
    return this.gitlabRepository.findMergeRequest(projectId, iid);
  }

  findMergeRequestByBranch(projectId: number, branch: string) {
    return this.gitlabRepository.findMergeRequestByBranch(projectId, branch);
  }

  findIssuesClosedOnMerge(projectId: number, iid: number) {
    return this.gitlabRepository.findIssuesClosedOnMerge(projectId, iid);
  }

  findUpdatedItems(issuable: GitLabIssuable, projectId: number, updatedAfter: string) {
    return this.gitlabRepository.findUpdatedItems(issuable, projectId, updatedAfter);
  }

  findNotes(issuable: GitLabIssuable, projectId: number, iid: number) {
    return this.gitlabRepository.findNotes(issuable, projectId, iid);
  }

  findLabelEvents(issuable: GitLabIssuable, projectId: number, iid: number) {
    return this.gitlabRepository.findLabelEvents(issuable, projectId, iid);
  }

  findStateEvents(issuable: GitLabIssuable, projectId: number, iid: number) {
    return this.gitlabRepository.findStateEvents(issuable, projectId, iid);
  }

  findMilestoneEvents(issuable: GitLabIssuable, projectId: number, iid: number) {
    return this.gitlabRepository.findMilestoneEvents(issuable, projectId, iid);
  }

  findIterationEvents(projectId: number, iid: number) {
    return this.gitlabRepository.findIterationEvents(projectId, iid);
  }

  findWeightEvents(projectId: number, iid: number) {
    return this.gitlabRepository.findWeightEvents(projectId, iid);
  }

  findMergeRequestCommits(projectId: number, iid: number) {
    return this.gitlabRepository.findMergeRequestCommits(projectId, iid);
  }

  async findPushCommits(
    projectId: number,
    { commit_from: from, commit_to: to, commit_count: count }: GitLabPushData,
  ): Promise<GitLabPushCommits> {
    if (!to || !count) {
      return { commits: [], rewritten: false };
    }
    if (from) {
      const line = await this.gitlabRepository.findFirstParentCommits(
        projectId,
        to,
        Math.min(count + 1, GITLAB_PAGE_SIZE),
      );
      const lineFrom = line.findIndex((commit) => commit.id === from);
      if (lineFrom !== -1) {
        return { commits: line.slice(0, lineFrom).toReversed(), rewritten: false };
      }
      const base = await this.gitlabRepository.findMergeBase(projectId, [from, to]);
      if (base?.id !== from) {
        return { commits: line.toReversed(), rewritten: true };
      }
    }
    const commits = await this.gitlabRepository.findCommits(
      projectId,
      to,
      Math.min(count, GITLAB_PAGE_SIZE),
    );
    const fromIndex = commits.findIndex((commit) => commit.id === from);
    return {
      commits: (fromIndex === -1 ? commits : commits.slice(0, fromIndex)).toReversed(),
      rewritten: false,
    };
  }

  async findDescriptionDiffs(noteIds: number[]) {
    const diffs = new Map<number, string>();
    for (let start = 0; start < noteIds.length; start += GITLAB_NOTES_PER_QUERY) {
      const batch = await this.gitlabRepository.findDescriptionDiffs(
        noteIds.slice(start, start + GITLAB_NOTES_PER_QUERY),
      );
      if (!batch) {
        return diffs;
      }
      batch.forEach((diff, id) => diffs.set(id, diff));
    }
    return diffs;
  }
}
