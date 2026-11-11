import { Injectable } from '@nestjs/common';
import type { DayRange } from 'src/common/types/date.interface';
import { isWithinDay } from 'src/common/utils/date.util';
import { GitLabLabelAction, GitLabState } from 'src/modules/vendors/gitlab/types/gitlab.enums';
import type { GitLabAuthor, GitLabCommit } from 'src/modules/vendors/gitlab/types/gitlab.interface';
import type {
  GitLabLabelEvent,
  GitLabNote,
  GitLabStateEvent,
  GitLabWeightEvent,
} from 'src/modules/vendors/gitlab/types/gitlab-history.interface';
import type { GitLabMergeRequest } from 'src/modules/vendors/gitlab/types/gitlab-issue.interface';
import { SourceActionKind } from '../types/source.enums';
import type { ReviewThreads } from '../types/source-day.interface';
import {
  GITLAB_SOURCE_ASSIGNEE_CHANGE,
  GITLAB_SOURCE_DRAFT_ACTIONS,
  GITLAB_SOURCE_REVIEWER_CHANGE,
} from './constants/gitlab-source-events.constants';
import type { SourcePlanHistory, SourceUserChange } from './types/gitlab-source.interface';
import { GitLabSourceNotes } from './gitlab-source.notes';

@Injectable()
export class GitLabSourceHistory {
  constructor(private readonly gitlabSourceNotes: GitLabSourceNotes) {}

  resolveStateAt(currentState: GitLabState, stateEvents: GitLabStateEvent[], moment: number) {
    if (!stateEvents.length) {
      return currentState;
    }
    const lastEvent = stateEvents
      .filter((event) => Date.parse(event.created_at) < moment)
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

  restoreLabels(current: string[], labelEvents: GitLabLabelEvent[], moment: number) {
    const labels = new Set(current);
    for (const event of this.toLatestFirst(labelEvents)) {
      if (!event.label || Date.parse(event.created_at) < moment) {
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

  restorePlan({ current, events }: SourcePlanHistory, moment: number) {
    const ordered = this.toLatestFirst(events).toReversed();
    const last = ordered.filter((event) => Date.parse(event.created_at) < moment).at(-1);
    if (last) {
      return last.action === GitLabLabelAction.ADD ? last.name : null;
    }
    const [first] = ordered;
    if (!first) {
      return current;
    }
    return first.action === GitLabLabelAction.REMOVE ? first.name : null;
  }

  restoreWeight(current: number | null, events: GitLabWeightEvent[], moment: number) {
    if (!events.length) {
      return current;
    }
    const last = this.toLatestFirst(events).find((event) => Date.parse(event.created_at) < moment);
    return last?.weight ?? null;
  }

  restoreAssignees(assignees: GitLabAuthor[] | undefined, notes: GitLabNote[], moment: number) {
    return this.restoreUsers(
      this.toUsernames(assignees),
      notes,
      moment,
      GITLAB_SOURCE_ASSIGNEE_CHANGE,
    );
  }

  restoreReviewers(mergeRequest: GitLabMergeRequest, notes: GitLabNote[], moment: number) {
    return this.restoreUsers(
      this.toUsernames(mergeRequest.reviewers),
      notes,
      moment,
      GITLAB_SOURCE_REVIEWER_CHANGE,
    );
  }

  resolveReviewers(mergeRequest: GitLabMergeRequest, notes: GitLabNote[], moment: number) {
    const atMoment = this.restoreReviewers(mergeRequest, notes, moment);
    const requested = notes
      .filter((note) => Date.parse(note.created_at) < moment)
      .flatMap(
        (note) => this.gitlabSourceNotes.parseUserChange(note, GITLAB_SOURCE_REVIEWER_CHANGE).added,
      );
    return [...new Set([...atMoment, ...requested])];
  }

  restoreDraft(current: boolean, notes: GitLabNote[], moment: number) {
    for (const note of this.toLatestFirst(notes).toReversed()) {
      const match = this.gitlabSourceNotes.match(note);
      if (
        match &&
        GITLAB_SOURCE_DRAFT_ACTIONS.has(match.kind) &&
        Date.parse(note.created_at) >= moment
      ) {
        return match.kind === SourceActionKind.MARKED_READY;
      }
    }
    return current;
  }

  resolveReviewThreads(notes: GitLabNote[], moment: number): ReviewThreads {
    const resolvable = notes.filter(
      (note) => note.resolvable && Date.parse(note.created_at) < moment,
    );
    return {
      total: resolvable.length,
      unresolved: resolvable.filter(
        (note) =>
          note.resolved === false || (note.resolved_at && Date.parse(note.resolved_at) >= moment),
      ).length,
    };
  }

  resolveStatus(notes: GitLabNote[], moment: number) {
    for (const note of this.toLatestFirst(notes)) {
      const match = this.gitlabSourceNotes.match(note);
      if (match?.kind === SourceActionKind.STATUS_SET && Date.parse(note.created_at) < moment) {
        return match.value;
      }
    }
    return null;
  }

  resolveTimeSpent(notes: GitLabNote[], employeeId: number, day: DayRange) {
    const seconds = notes
      .filter((note) => note.author.id === employeeId)
      .map((note) => this.gitlabSourceNotes.parseTimeSpent(note))
      .filter((spent) => spent !== null && isWithinDay(spent.at, day))
      .reduce((total, spent) => total + (spent?.seconds ?? 0), 0);
    return Math.max(0, seconds);
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
    moment: number,
    change: SourceUserChange,
  ) {
    const users = new Set(current);
    for (const note of this.toLatestFirst(notes)) {
      if (Date.parse(note.created_at) < moment) {
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
