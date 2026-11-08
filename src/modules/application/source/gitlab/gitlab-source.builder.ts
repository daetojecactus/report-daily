import { Injectable } from '@nestjs/common';
import type { DayRange } from 'src/common/interfaces/date.interface';
import { isWithinDay } from 'src/common/utils/date.util';
import { GitLabState } from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabEvent,
  GitLabLabelEvent,
  GitLabNote,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import type {
  CleanEvent,
  CleanLabelEvent,
  CleanNote,
  GroupedDailyData,
  GroupedIssue,
  GroupedMergeRequest,
  StandalonePush,
} from '../source.interface';
import { SourceRefType } from '../source.enums';
import {
  GITLAB_SOURCE_ITEM_STATES,
  GITLAB_SOURCE_LABEL_ACTIONS,
  GITLAB_SOURCE_REF_TYPES,
} from './constants/gitlab-source.constants';
import { GitLabSourceFacts } from './gitlab-source.facts';
import { GitLabSourceHistory } from './gitlab-source.history';
import type {
  DayActivity,
  IssueActivity,
  MergeRequestActivity,
  SourceBranch,
  SourceBuildContext,
  SourceEmployee,
  SourceEvents,
} from './gitlab-source.interface';

@Injectable()
export class GitLabSourceBuilder {
  constructor(
    private readonly gitlabSourceHistory: GitLabSourceHistory,
    private readonly gitlabSourceFacts: GitLabSourceFacts,
  ) {}

  build(activity: DayActivity, day: DayRange, employee: SourceEmployee): GroupedDailyData {
    const context: SourceBuildContext = {
      day,
      employee,
      pushCommits: activity.pushCommits,
    };
    return {
      projects: activity.projects.map((project) => ({
        id: project.id,
        name: project.name,
        path: project.path_with_namespace,
        webUrl: project.web_url,
      })),
      issues: activity.issues.map((issue) => this.buildIssue(issue, context)),
      standaloneMergeRequests: activity.mergeRequests.map((mergeRequest) =>
        this.buildMergeRequest(mergeRequest, context),
      ),
      standalonePushes: [
        ...activity.pushes.map((push) => this.buildPush(push, context, false)),
        ...activity.directPushes.map((push) => this.buildPush(push, context, true)),
        ...activity.refs.map(({ target, events }) => ({
          ...target,
          mainBranch: false,
          events: this.cleanEvents(events, context),
        })),
      ],
    };
  }

  private buildPush(
    { target, events }: SourceEvents<SourceBranch>,
    context: SourceBuildContext,
    mainBranch: boolean,
  ): StandalonePush {
    return {
      projectId: target.projectId,
      ref: target.branch,
      refType: SourceRefType.BRANCH,
      mainBranch,
      events: this.cleanEvents(events, context),
    };
  }

  private buildIssue(activity: IssueActivity, context: SourceBuildContext): GroupedIssue {
    const { issue, notes, labelEvents, stateEvents } = activity;
    const { day } = context;
    return {
      projectId: issue.project_id,
      iid: issue.iid,
      title: issue.title,
      state:
        GITLAB_SOURCE_ITEM_STATES[
          this.gitlabSourceHistory.resolveStateAt(issue.state, stateEvents, day.end)
        ],
      closedOnReportDate: this.gitlabSourceHistory.hasStateChangeOnDate(
        stateEvents,
        day,
        GitLabState.CLOSED,
      ),
      webUrl: issue.web_url,
      labels: this.gitlabSourceHistory.restoreLabels(issue.labels, labelEvents, day.end),
      createdAt: issue.created_at,
      assignees: this.gitlabSourceHistory.restoreAssignees(issue.assignees, notes, day.end),
      status: this.gitlabSourceHistory.resolveStatus(notes, day.end),
      startOfDay: {
        state:
          GITLAB_SOURCE_ITEM_STATES[
            this.gitlabSourceHistory.resolveStateAt(issue.state, stateEvents, day.start)
          ],
        labels: this.gitlabSourceHistory.restoreLabels(issue.labels, labelEvents, day.start),
        assignees: this.gitlabSourceHistory.restoreAssignees(issue.assignees, notes, day.start),
        status: this.gitlabSourceHistory.resolveStatus(notes, day.start),
      },
      facts: this.gitlabSourceFacts.resolve(issue, activity, context),
      events: this.cleanEvents(activity.events, context),
      notes: this.cleanNotes(notes, day),
      labelEvents: this.cleanLabelEvents(labelEvents, day),
      mergeRequests: activity.mergeRequests.map((mergeRequest) =>
        this.buildMergeRequest(mergeRequest, context),
      ),
      pushes: activity.pushes.map((push) => this.buildPush(push, context, false)),
    };
  }

  private buildMergeRequest(
    activity: MergeRequestActivity,
    context: SourceBuildContext,
  ): GroupedMergeRequest {
    const { mergeRequest, notes, labelEvents, stateEvents } = activity;
    const { day } = context;
    return {
      projectId: mergeRequest.project_id,
      iid: mergeRequest.iid,
      title: mergeRequest.title,
      state:
        GITLAB_SOURCE_ITEM_STATES[
          this.gitlabSourceHistory.resolveStateAt(mergeRequest.state, stateEvents, day.end)
        ],
      mergedOnReportDate: this.gitlabSourceHistory.hasStateChangeOnDate(
        stateEvents,
        day,
        GitLabState.MERGED,
      ),
      draft: this.gitlabSourceHistory.restoreDraft(mergeRequest.draft ?? false, notes, day.end),
      webUrl: mergeRequest.web_url,
      sourceBranch: mergeRequest.source_branch,
      labels: this.gitlabSourceHistory.restoreLabels(mergeRequest.labels, labelEvents, day.end),
      createdAt: mergeRequest.created_at,
      lastCommitAt: this.gitlabSourceHistory.resolveLastCommitBeforeDate(activity.commits, day),
      author: mergeRequest.author?.username ?? null,
      assignees: this.gitlabSourceHistory.restoreAssignees(mergeRequest.assignees, notes, day.end),
      reviewers: this.gitlabSourceHistory.resolveReviewers(mergeRequest, notes, day.end),
      closesIssues: activity.closingIssues.map((issue) => ({
        projectId: issue.project_id,
        iid: issue.iid,
        title: issue.title,
        webUrl: issue.web_url,
      })),
      startOfDay: {
        state:
          GITLAB_SOURCE_ITEM_STATES[
            this.gitlabSourceHistory.resolveStateAt(mergeRequest.state, stateEvents, day.start)
          ],
        labels: this.gitlabSourceHistory.restoreLabels(mergeRequest.labels, labelEvents, day.start),
        assignees: this.gitlabSourceHistory.restoreAssignees(
          mergeRequest.assignees,
          notes,
          day.start,
        ),
        status: null,
        reviewers: this.gitlabSourceHistory.restoreReviewers(mergeRequest, notes, day.start),
        draft: this.gitlabSourceHistory.restoreDraft(mergeRequest.draft ?? false, notes, day.start),
      },
      facts: this.gitlabSourceFacts.resolve(mergeRequest, activity, context),
      events: this.cleanEvents(activity.events, context),
      notes: this.cleanNotes(notes, day),
      labelEvents: this.cleanLabelEvents(labelEvents, day),
      reviewThreads: this.gitlabSourceHistory.resolveReviewThreads(notes, day.end),
    };
  }

  private cleanEvents(events: GitLabEvent[], { pushCommits }: SourceBuildContext): CleanEvent[] {
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
        refType: GITLAB_SOURCE_REF_TYPES[event.push_data.ref_type],
        ref: event.push_data.ref,
        refCount: event.push_data.ref_count,
        commitTitle: event.push_data.commit_title,
        commits: (pushCommits.get(event.id) ?? []).map((commit) => ({
          id: commit.id,
          title: commit.title,
        })),
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

  private cleanLabelEvents(labelEvents: GitLabLabelEvent[], day: DayRange): CleanLabelEvent[] {
    return labelEvents.flatMap((event) =>
      event.label && isWithinDay(event.created_at, day)
        ? [
            {
              id: event.id,
              labelName: event.label.name,
              action: GITLAB_SOURCE_LABEL_ACTIONS[event.action],
              createdAt: event.created_at,
              username: event.user.username,
            },
          ]
        : [],
    );
  }
}
