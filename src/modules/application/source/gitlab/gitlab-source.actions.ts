import { Injectable } from '@nestjs/common';
import { isWithinDay } from 'src/common/utils/date.util';
import { GitLabLabelAction } from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabAuthor,
  GitLabIssue,
  GitLabMergeRequest,
  GitLabNote,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import { SourceActionKind } from '../source.enums';
import type { SourceAction } from '../source.interface';
import {
  GITLAB_SOURCE_ASSIGNEE_CHANGE,
  GITLAB_SOURCE_REVIEWER_CHANGE,
  GITLAB_SOURCE_STATE_ACTIONS,
} from './constants/gitlab-source.constants';
import type {
  IssueActivity,
  MergeRequestActivity,
  SourceBuildContext,
} from './gitlab-source.interface';
import { GitLabSourceNotes } from './gitlab-source.notes';

@Injectable()
export class GitLabSourceActions {
  constructor(private readonly gitlabSourceNotes: GitLabSourceNotes) {}

  resolve(
    item: GitLabIssue | GitLabMergeRequest,
    { notes, labelEvents, stateEvents }: IssueActivity | MergeRequestActivity,
    context: SourceBuildContext,
  ) {
    const actions: SourceAction[] = [];
    if (this.isOwn(item.author, item.created_at, context)) {
      actions.push(this.toAction(SourceActionKind.OPENED, item.created_at));
    }
    for (const note of notes) {
      if (this.isOwn(note.author, note.created_at, context)) {
        actions.push(...this.toNoteActions(note));
      }
    }
    for (const event of labelEvents) {
      if (event.label && this.isOwn(event.user, event.created_at, context)) {
        actions.push(
          this.toAction(
            event.action === GitLabLabelAction.ADD
              ? SourceActionKind.LABEL_ADDED
              : SourceActionKind.LABEL_REMOVED,
            event.created_at,
            event.label.name,
          ),
        );
      }
    }
    for (const event of stateEvents) {
      const kind = GITLAB_SOURCE_STATE_ACTIONS.get(event.state);
      if (kind && this.isOwn(event.user, event.created_at, context)) {
        actions.push(this.toAction(kind, event.created_at));
      }
    }
    return actions.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  }

  private toNoteActions(note: GitLabNote): SourceAction[] {
    if (!note.system) {
      return [this.toAction(SourceActionKind.COMMENTED, note.created_at)];
    }
    const assignees = this.gitlabSourceNotes.parseUserChange(note, GITLAB_SOURCE_ASSIGNEE_CHANGE);
    const reviewers = this.gitlabSourceNotes.parseUserChange(note, GITLAB_SOURCE_REVIEWER_CHANGE);
    const userActions = [
      { kind: SourceActionKind.ASSIGNED, users: assignees.added },
      { kind: SourceActionKind.UNASSIGNED, users: assignees.removed },
      { kind: SourceActionKind.REVIEW_REQUESTED, users: reviewers.added },
      { kind: SourceActionKind.REVIEW_REQUEST_REMOVED, users: reviewers.removed },
    ]
      .filter(({ users }) => users.length)
      .map(({ kind, users }) => this.toAction(kind, note.created_at, null, users));
    if (userActions.length) {
      return userActions;
    }
    const match = this.gitlabSourceNotes.match(note);
    return match ? [this.toAction(match.kind, note.created_at, match.value)] : [];
  }

  private isOwn(
    user: GitLabAuthor | null | undefined,
    at: string,
    { day, userId }: SourceBuildContext,
  ) {
    return user?.id === userId && isWithinDay(at, day);
  }

  private toAction(
    kind: SourceActionKind,
    at: string,
    value: string | null = null,
    users: string[] = [],
  ): SourceAction {
    return { kind, at, value, users };
  }
}
