import { Injectable } from '@nestjs/common';
import type { DayRange } from 'src/common/interfaces/date.interface';
import { isWithinDay } from 'src/common/utils/date.util';
import { GitLabState } from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabCommit,
  GitLabEvent,
  GitLabLabelEvent,
  GitLabMergeRequest,
  GitLabNote,
  GitLabStateEvent,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import {
  SOURCE_MENTION_PATTERN,
  SOURCE_REVIEW_REQUEST_PREFIX,
} from './constants/source.constants';
import type {
  CleanEvent,
  CleanLabelEvent,
  CleanNote,
  DayActivity,
  GroupedDailyData,
  GroupedIssue,
  GroupedMergeRequest,
  IssueActivity,
  MergeRequestActivity,
  ReviewThreads,
} from './source.interface';

@Injectable()
export class SourceBuilder {
  build(activity: DayActivity, day: DayRange): GroupedDailyData {
    return {
      projects: activity.projects.map((project) => ({
        id: project.id,
        name: project.name,
        path: project.path_with_namespace,
        webUrl: project.web_url,
      })),
      issues: activity.issues.map((issue) => this.buildIssue(issue, day)),
      standaloneMergeRequests: activity.mergeRequests.map((mergeRequest) =>
        this.buildMergeRequest(mergeRequest, day),
      ),
      standalonePushes: activity.pushes.map(({ target, events }) => ({
        projectId: target.projectId,
        branch: target.branch,
        events: this.cleanEvents(events),
      })),
    };
  }

  private buildIssue(activity: IssueActivity, day: DayRange): GroupedIssue {
    const { issue, stateEvents } = activity;
    return {
      projectId: issue.project_id,
      iid: issue.iid,
      title: issue.title,
      state: this.resolveStateAsOfDate(issue.state, stateEvents, day),
      closedOnReportDate: this.hasStateChangeOnDate(
        stateEvents,
        day,
        GitLabState.CLOSED,
      ),
      webUrl: issue.web_url,
      labels: issue.labels,
      createdAt: issue.created_at,
      assignee: issue.assignee?.username ?? null,
      events: this.cleanEvents(activity.events),
      notes: this.cleanNotes(activity.notes, day),
      labelEvents: this.cleanLabelEvents(activity.labelEvents, day),
      mergeRequests: activity.mergeRequests.map((mergeRequest) =>
        this.buildMergeRequest(mergeRequest, day),
      ),
    };
  }

  private buildMergeRequest(
    activity: MergeRequestActivity,
    day: DayRange,
  ): GroupedMergeRequest {
    const { mergeRequest, notes, stateEvents } = activity;
    return {
      projectId: mergeRequest.project_id,
      iid: mergeRequest.iid,
      title: mergeRequest.title,
      state: this.resolveStateAsOfDate(mergeRequest.state, stateEvents, day),
      mergedOnReportDate: this.hasStateChangeOnDate(
        stateEvents,
        day,
        GitLabState.MERGED,
      ),
      webUrl: mergeRequest.web_url,
      sourceBranch: mergeRequest.source_branch,
      labels: mergeRequest.labels,
      createdAt: mergeRequest.created_at,
      lastCommitAt: this.resolveLastCommitBeforeDate(activity.commits, day),
      author: mergeRequest.author?.username ?? null,
      assignee: mergeRequest.assignee?.username ?? null,
      reviewers: this.resolveReviewers(mergeRequest, notes),
      events: this.cleanEvents(activity.events),
      notes: this.cleanNotes(notes, day),
      labelEvents: this.cleanLabelEvents(activity.labelEvents, day),
      reviewThreads: this.resolveReviewThreads(notes),
    };
  }

  private resolveReviewers(
    mergeRequest: GitLabMergeRequest,
    notes: GitLabNote[],
  ) {
    const current =
      mergeRequest.reviewers?.map((reviewer) => reviewer.username) ?? [];
    return [
      ...new Set([...current, ...this.extractHistoricalReviewers(notes)]),
    ];
  }

  private extractHistoricalReviewers(notes: GitLabNote[]) {
    return notes
      .filter(
        (note) =>
          note.system &&
          note.body.toLowerCase().startsWith(SOURCE_REVIEW_REQUEST_PREFIX),
      )
      .flatMap((note) =>
        [...note.body.matchAll(SOURCE_MENTION_PATTERN)].map(
          ([, username]) => username,
        ),
      );
  }

  private resolveReviewThreads(notes: GitLabNote[]): ReviewThreads {
    const resolvable = notes.filter((note) => note.resolvable);
    return {
      total: resolvable.length,
      unresolved: resolvable.filter((note) => note.resolved === false).length,
    };
  }

  private resolveStateAsOfDate(
    currentState: GitLabState,
    stateEvents: GitLabStateEvent[],
    day: DayRange,
  ) {
    if (!stateEvents.length) {
      return currentState;
    }
    const lastEvent = stateEvents
      .filter((event) => Date.parse(event.created_at) < day.end)
      .sort(
        (left, right) =>
          Date.parse(left.created_at) - Date.parse(right.created_at),
      )
      .at(-1);
    if (!lastEvent) {
      return GitLabState.OPENED;
    }
    return lastEvent.state === GitLabState.REOPENED
      ? GitLabState.OPENED
      : lastEvent.state;
  }

  private hasStateChangeOnDate(
    stateEvents: GitLabStateEvent[],
    day: DayRange,
    state: GitLabState,
  ) {
    return stateEvents.some(
      (event) => event.state === state && isWithinDay(event.created_at, day),
    );
  }

  private resolveLastCommitBeforeDate(commits: GitLabCommit[], day: DayRange) {
    const times = commits
      .map((commit) => Date.parse(commit.committed_date ?? commit.created_at))
      .filter((time) => time < day.start);
    return times.length ? new Date(Math.max(...times)).toISOString() : null;
  }

  private cleanEvents(events: GitLabEvent[]): CleanEvent[] {
    return events.map((event) => ({
      id: event.id,
      projectId: event.project_id,
      actionName: event.action_name,
      targetType: event.target_type,
      targetTitle: event.target_title,
      createdAt: event.created_at,
      pushData: event.push_data && {
        commitCount: event.push_data.commit_count,
        action: event.push_data.action,
        refType: event.push_data.ref_type,
        ref: event.push_data.ref,
        commitTitle: event.push_data.commit_title,
      },
      noteBody: event.note?.body,
    }));
  }

  private cleanNotes(notes: GitLabNote[], day: DayRange): CleanNote[] {
    return notes
      .filter((note) => isWithinDay(note.created_at, day))
      .map((note) => ({
        id: note.id,
        body: note.body,
        authorUsername: note.author.username,
        authorName: note.author.name,
        createdAt: note.created_at,
        system: note.system,
        noteableType: note.noteable_type,
        resolvable: note.resolvable,
        resolved: note.resolved,
      }));
  }

  private cleanLabelEvents(
    labelEvents: GitLabLabelEvent[],
    day: DayRange,
  ): CleanLabelEvent[] {
    return labelEvents.flatMap((event) =>
      event.label && isWithinDay(event.created_at, day)
        ? [
            {
              id: event.id,
              labelName: event.label.name,
              action: event.action,
              createdAt: event.created_at,
              username: event.user.username,
            },
          ]
        : [],
    );
  }
}
