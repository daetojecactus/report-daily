import { Injectable } from '@nestjs/common';
import type { DayRange } from 'src/common/interfaces/date.interface';
import { isWithinDay } from 'src/common/utils/date.util';
import {
  GitLabLabelAction,
  GitLabState,
} from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabAuthor,
  GitLabCommit,
  GitLabEvent,
  GitLabLabelEvent,
  GitLabMergeRequest,
  GitLabNote,
  GitLabStateEvent,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import {
  SOURCE_ASSIGNEE_CHANGE,
  SOURCE_DRAFT_PATTERN,
  SOURCE_MENTION_PATTERN,
  SOURCE_READY_MARK,
  SOURCE_REVIEWER_CHANGE,
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
  SourceUserChange,
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
    const { issue, notes, labelEvents, stateEvents } = activity;
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
      labels: this.restoreLabels(issue.labels, labelEvents, day),
      createdAt: issue.created_at,
      assignees: this.restoreUsers(
        this.toUsernames(issue.assignees),
        notes,
        day,
        SOURCE_ASSIGNEE_CHANGE,
      ),
      events: this.cleanEvents(activity.events),
      notes: this.cleanNotes(notes, day),
      labelEvents: this.cleanLabelEvents(labelEvents, day),
      mergeRequests: activity.mergeRequests.map((mergeRequest) =>
        this.buildMergeRequest(mergeRequest, day),
      ),
    };
  }

  private buildMergeRequest(
    activity: MergeRequestActivity,
    day: DayRange,
  ): GroupedMergeRequest {
    const { mergeRequest, notes, labelEvents, stateEvents } = activity;
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
      draft: this.restoreDraft(mergeRequest.draft ?? false, notes, day),
      webUrl: mergeRequest.web_url,
      sourceBranch: mergeRequest.source_branch,
      labels: this.restoreLabels(mergeRequest.labels, labelEvents, day),
      createdAt: mergeRequest.created_at,
      lastCommitAt: this.resolveLastCommitBeforeDate(activity.commits, day),
      author: mergeRequest.author?.username ?? null,
      assignees: this.restoreUsers(
        this.toUsernames(mergeRequest.assignees),
        notes,
        day,
        SOURCE_ASSIGNEE_CHANGE,
      ),
      reviewers: this.resolveReviewers(mergeRequest, notes, day),
      closesIssues: activity.closingIssues.map((issue) => ({
        projectId: issue.project_id,
        iid: issue.iid,
        title: issue.title,
        webUrl: issue.web_url,
      })),
      events: this.cleanEvents(activity.events),
      notes: this.cleanNotes(notes, day),
      labelEvents: this.cleanLabelEvents(labelEvents, day),
      reviewThreads: this.resolveReviewThreads(notes, day),
    };
  }

  private restoreLabels(
    current: string[],
    labelEvents: GitLabLabelEvent[],
    day: DayRange,
  ) {
    const labels = new Set(current);
    for (const event of this.toLatestFirst(labelEvents)) {
      if (!event.label || Date.parse(event.created_at) < day.end) {
        continue;
      }
      if (event.action === GitLabLabelAction.ADD) {
        labels.delete(event.label.name);
      } else {
        labels.add(event.label.name);
      }
    }
    return [...labels];
  }

  private restoreUsers(
    current: string[],
    notes: GitLabNote[],
    day: DayRange,
    change: SourceUserChange,
  ) {
    const users = new Set(current);
    for (const note of this.toLatestFirst(notes)) {
      if (Date.parse(note.created_at) < day.end) {
        continue;
      }
      const { added, removed } = this.parseUserChange(note, change);
      added.forEach((user) => users.delete(user));
      removed.forEach((user) => users.add(user));
    }
    return [...users];
  }

  private resolveReviewers(
    mergeRequest: GitLabMergeRequest,
    notes: GitLabNote[],
    day: DayRange,
  ) {
    const atEndOfDay = this.restoreUsers(
      this.toUsernames(mergeRequest.reviewers),
      notes,
      day,
      SOURCE_REVIEWER_CHANGE,
    );
    const requested = notes
      .filter((note) => Date.parse(note.created_at) < day.end)
      .flatMap(
        (note) => this.parseUserChange(note, SOURCE_REVIEWER_CHANGE).added,
      );
    return [...new Set([...atEndOfDay, ...requested])];
  }

  private parseUserChange(note: GitLabNote, change: SourceUserChange) {
    const { body } = note;
    const isAdded = body.startsWith(change.added);
    if (!note.system || (!isAdded && !body.startsWith(change.removed))) {
      return { added: [], removed: [] };
    }
    const removedAt = body.indexOf(change.removed);
    return {
      added: isAdded
        ? this.toMentions(
            body.slice(0, removedAt === -1 ? undefined : removedAt),
          )
        : [],
      removed: removedAt === -1 ? [] : this.toMentions(body.slice(removedAt)),
    };
  }

  private restoreDraft(current: boolean, notes: GitLabNote[], day: DayRange) {
    const firstMark = this.toLatestFirst(notes)
      .reverse()
      .filter((note) => note.system && Date.parse(note.created_at) >= day.end)
      .map((note) => SOURCE_DRAFT_PATTERN.exec(note.body)?.[1])
      .find((mark) => mark !== undefined);
    return firstMark === undefined ? current : firstMark === SOURCE_READY_MARK;
  }

  private resolveReviewThreads(
    notes: GitLabNote[],
    day: DayRange,
  ): ReviewThreads {
    const resolvable = notes.filter(
      (note) => note.resolvable && Date.parse(note.created_at) < day.end,
    );
    return {
      total: resolvable.length,
      unresolved: resolvable.filter(
        (note) =>
          note.resolved === false ||
          (note.resolved_at && Date.parse(note.resolved_at) >= day.end),
      ).length,
    };
  }

  private toLatestFirst<T extends { created_at: string }>(items: T[]) {
    return items.toSorted(
      (left, right) =>
        Date.parse(right.created_at) - Date.parse(left.created_at),
    );
  }

  private toMentions(text: string) {
    return [...text.matchAll(SOURCE_MENTION_PATTERN)].map(
      ([, username]) => username,
    );
  }

  private toUsernames(users: GitLabAuthor[] | undefined) {
    return users?.map((user) => user.username) ?? [];
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
