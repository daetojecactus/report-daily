import { Injectable } from '@nestjs/common';
import { isWithinDay } from 'src/common/utils/date.util';
import { GitLabLabelAction } from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabAuthor,
  GitLabIssue,
  GitLabMergeRequest,
  GitLabNote,
  GitLabWeightEvent,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import { SourceActionKind } from '../source.enums';
import type { SourceFact } from '../source.interface';
import {
  GITLAB_SOURCE_ASSIGNEE_CHANGE,
  GITLAB_SOURCE_ITERATION_ACTIONS,
  GITLAB_SOURCE_MILESTONE_ACTIONS,
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
export class GitLabSourceFacts {
  constructor(private readonly gitlabSourceNotes: GitLabSourceNotes) {}

  resolve(
    item: GitLabIssue | GitLabMergeRequest,
    activity: IssueActivity | MergeRequestActivity,
    context: SourceBuildContext,
  ) {
    const { events, notes, labelEvents, stateEvents } = activity;
    const facts: SourceFact[] = [];
    if (this.isOfDay(item.created_at, context)) {
      facts.push(this.toFact(SourceActionKind.OPENED, item.created_at, item.author, context));
    }
    for (const note of notes) {
      if (this.isOfDay(note.created_at, context)) {
        facts.push(...this.toNoteFacts(note, context));
      }
    }
    for (const event of labelEvents) {
      if (event.label && this.isOfDay(event.created_at, context)) {
        facts.push(
          this.toFact(
            event.action === GitLabLabelAction.ADD
              ? SourceActionKind.LABEL_ADDED
              : SourceActionKind.LABEL_REMOVED,
            event.created_at,
            event.user,
            context,
            event.label.name,
          ),
        );
      }
    }
    for (const event of stateEvents) {
      const kind = GITLAB_SOURCE_STATE_ACTIONS.get(event.state);
      if (kind && this.isOfDay(event.created_at, context)) {
        facts.push(this.toFact(kind, event.created_at, event.user, context));
      }
    }
    const plans = [
      { history: activity.milestones, kinds: GITLAB_SOURCE_MILESTONE_ACTIONS },
      ...('iterations' in activity
        ? [{ history: activity.iterations, kinds: GITLAB_SOURCE_ITERATION_ACTIONS }]
        : []),
    ];
    for (const { history, kinds } of plans) {
      for (const event of history.events) {
        if (this.isOfDay(event.created_at, context)) {
          facts.push(
            this.toFact(kinds[event.action], event.created_at, event.user, context, event.name),
          );
        }
      }
    }
    if ('weightEvents' in activity) {
      facts.push(...this.toWeightFacts(activity.weightEvents, context));
    }
    for (const event of events) {
      if (event.push_data && this.isOfDay(event.created_at, context)) {
        facts.push(
          this.toFact(
            SourceActionKind.PUSHED,
            event.created_at,
            context.employee,
            context,
            event.push_data.ref,
          ),
        );
      }
    }
    return facts.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  }

  private toWeightFacts(events: GitLabWeightEvent[], context: SourceBuildContext) {
    const facts: SourceFact[] = [];
    let previous: number | null = null;
    for (const event of events.toSorted(
      (left, right) => Date.parse(left.created_at) - Date.parse(right.created_at),
    )) {
      if (this.isOfDay(event.created_at, context)) {
        const removed = event.weight === null;
        const weight = removed ? previous : event.weight;
        facts.push(
          this.toFact(
            removed ? SourceActionKind.WEIGHT_REMOVED : SourceActionKind.WEIGHT_SET,
            event.created_at,
            event.user,
            context,
            weight === null ? null : String(weight),
          ),
        );
      }
      previous = event.weight;
    }
    return facts;
  }

  private toNoteFacts(note: GitLabNote, context: SourceBuildContext): SourceFact[] {
    if (!note.system) {
      return [this.toFact(SourceActionKind.COMMENTED, note.created_at, note.author, context)];
    }
    const assignees = this.gitlabSourceNotes.parseUserChange(note, GITLAB_SOURCE_ASSIGNEE_CHANGE);
    const reviewers = this.gitlabSourceNotes.parseUserChange(note, GITLAB_SOURCE_REVIEWER_CHANGE);
    const userFacts = [
      { kind: SourceActionKind.ASSIGNED, users: assignees.added },
      { kind: SourceActionKind.UNASSIGNED, users: assignees.removed },
      { kind: SourceActionKind.REVIEW_REQUESTED, users: reviewers.added },
      { kind: SourceActionKind.REVIEW_REQUEST_REMOVED, users: reviewers.removed },
    ]
      .filter(({ users }) => users.length)
      .map(({ kind, users }) =>
        this.toFact(kind, note.created_at, note.author, context, null, users),
      );
    if (userFacts.length) {
      return userFacts;
    }
    const match = this.gitlabSourceNotes.match(note);
    return match
      ? [this.toFact(match.kind, note.created_at, note.author, context, match.value)]
      : [];
  }

  private isOfDay(at: string, { day }: SourceBuildContext) {
    return isWithinDay(at, day);
  }

  private toFact(
    kind: SourceActionKind,
    at: string,
    actor: Pick<GitLabAuthor, 'id' | 'username'> | null | undefined,
    { employee }: SourceBuildContext,
    value: string | null = null,
    users: string[] = [],
  ): SourceFact {
    return {
      kind,
      at,
      actor: actor?.username ?? null,
      own: actor?.id === employee.id,
      value,
      users,
    };
  }
}
