import { Injectable } from '@nestjs/common';
import type { DayRange } from 'src/common/interfaces/date.interface';
import { isWithinDay } from 'src/common/utils/date.util';
import { GitLabLabelAction, GitLabState } from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabAuthor,
  GitLabCommit,
  GitLabLabelEvent,
  GitLabMergeRequest,
  GitLabNote,
  GitLabStateEvent,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import { SourceActionKind } from '../source.enums';
import type { ReviewThreads } from '../source.interface';
import {
  GITLAB_SOURCE_ASSIGNEE_CHANGE,
  GITLAB_SOURCE_DRAFT_ACTIONS,
  GITLAB_SOURCE_REVIEWER_CHANGE,
} from './constants/gitlab-source.constants';
import type { SourceUserChange } from './gitlab-source.interface';
import { GitLabSourceNotes } from './gitlab-source.notes';

@Injectable()
export class GitLabSourceHistory {
  constructor(private readonly gitlabSourceNotes: GitLabSourceNotes) {}

  resolveStateAsOfDate(currentState: GitLabState, stateEvents: GitLabStateEvent[], day: DayRange) {
    if (!stateEvents.length) {
      return currentState;
    }
    const lastEvent = stateEvents
      .filter((event) => Date.parse(event.created_at) < day.end)
      .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
      .at(-1);
    if (!lastEvent) {
      return GitLabState.OPENED;
    }
    return lastEvent.state === GitLabState.REOPENED ? GitLabState.OPENED : lastEvent.state;
  }

  hasStateChangeOnDate(stateEvents: GitLabStateEvent[], day: DayRange, state: GitLabState) {
    return stateEvents.some((event) => event.state === state && isWithinDay(event.created_at, day));
  }

  restoreLabels(current: string[], labelEvents: GitLabLabelEvent[], day: DayRange) {
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

  restoreAssignees(assignees: GitLabAuthor[] | undefined, notes: GitLabNote[], day: DayRange) {
    return this.restoreUsers(
      this.toUsernames(assignees),
      notes,
      day,
      GITLAB_SOURCE_ASSIGNEE_CHANGE,
    );
  }

  resolveReviewers(mergeRequest: GitLabMergeRequest, notes: GitLabNote[], day: DayRange) {
    const atEndOfDay = this.restoreUsers(
      this.toUsernames(mergeRequest.reviewers),
      notes,
      day,
      GITLAB_SOURCE_REVIEWER_CHANGE,
    );
    const requested = notes
      .filter((note) => Date.parse(note.created_at) < day.end)
      .flatMap(
        (note) => this.gitlabSourceNotes.parseUserChange(note, GITLAB_SOURCE_REVIEWER_CHANGE).added,
      );
    return [...new Set([...atEndOfDay, ...requested])];
  }

  restoreDraft(current: boolean, notes: GitLabNote[], day: DayRange) {
    for (const note of this.toLatestFirst(notes).toReversed()) {
      const match = this.gitlabSourceNotes.match(note);
      if (
        match &&
        GITLAB_SOURCE_DRAFT_ACTIONS.has(match.kind) &&
        Date.parse(note.created_at) >= day.end
      ) {
        return match.kind === SourceActionKind.MARKED_READY;
      }
    }
    return current;
  }

  resolveReviewThreads(notes: GitLabNote[], day: DayRange): ReviewThreads {
    const resolvable = notes.filter(
      (note) => note.resolvable && Date.parse(note.created_at) < day.end,
    );
    return {
      total: resolvable.length,
      unresolved: resolvable.filter(
        (note) =>
          note.resolved === false || (note.resolved_at && Date.parse(note.resolved_at) >= day.end),
      ).length,
    };
  }

  resolveStatus(notes: GitLabNote[], day: DayRange) {
    for (const note of this.toLatestFirst(notes)) {
      const match = this.gitlabSourceNotes.match(note);
      if (match?.kind === SourceActionKind.STATUS_SET && Date.parse(note.created_at) < day.end) {
        return match.value;
      }
    }
    return null;
  }

  resolveLastCommitBeforeDate(commits: GitLabCommit[], day: DayRange) {
    const times = commits
      .map((commit) => Date.parse(commit.committed_date ?? commit.created_at))
      .filter((time) => time < day.start);
    return times.length ? new Date(Math.max(...times)).toISOString() : null;
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
      const { added, removed } = this.gitlabSourceNotes.parseUserChange(note, change);
      added.forEach((user) => users.delete(user));
      removed.forEach((user) => users.add(user));
    }
    return [...users];
  }

  private toLatestFirst<T extends { created_at: string }>(items: T[]) {
    return items.toSorted(
      (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
    );
  }

  private toUsernames(users: GitLabAuthor[] | undefined) {
    return users?.map((user) => user.username) ?? [];
  }
}
