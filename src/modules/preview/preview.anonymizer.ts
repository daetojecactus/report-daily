import { Injectable } from '@nestjs/common';
import { toSourceKey } from 'src/common/utils/source-name.util';
import {
  GITLAB_SOURCE_BRANCH_ISSUE_PATTERN,
  GITLAB_SOURCE_MAIN_BRANCHES,
  GITLAB_SOURCE_MENTION_PATTERN,
} from 'src/modules/application/source/gitlab/constants/gitlab-source.constants';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import type {
  CleanEvent,
  CleanNote,
  CleanPushData,
  GroupedDailyData,
  GroupedIssue,
  GroupedMergeRequest,
  SourceAction,
  SourceProject,
} from 'src/modules/application/source/source.interface';
import {
  PREVIEW_ACTION_VALUE,
  PREVIEW_BOT_BRANCH_PATTERN,
  PREVIEW_BRANCH_ALIAS,
  PREVIEW_BRANCH_NOTE_PATTERN,
  PREVIEW_COMMENT,
  PREVIEW_COMMIT_ALIAS,
  PREVIEW_COMMIT_TITLE,
  PREVIEW_GROUP,
  PREVIEW_ISSUE_TITLE,
  PREVIEW_ISSUES_PATH,
  PREVIEW_KEPT_LABELS,
  PREVIEW_KEPT_STATUSES,
  PREVIEW_LABEL_ALIAS,
  PREVIEW_MERGE_REQUEST_TITLE,
  PREVIEW_MERGE_REQUESTS_PATH,
  PREVIEW_NOTE_PREFIXES,
  PREVIEW_PROJECT_ALIAS,
  PREVIEW_RU_TEST_COMMIT_PATTERN,
  PREVIEW_RU_TEST_COMMIT_PREFIX,
  PREVIEW_STATUS_ALIAS,
  PREVIEW_STATUS_NOTE_PATTERN,
  PREVIEW_SYSTEM_NOTE,
  PREVIEW_TARGET_TITLE,
  PREVIEW_TEST_COMMIT_PATTERN,
  PREVIEW_TEST_COMMIT_PREFIX,
  PREVIEW_TITLE_NOTE,
  PREVIEW_TITLE_NOTE_PATTERN,
  PREVIEW_URL,
  PREVIEW_USER_ALIAS,
  PREVIEW_USER_NOTE_PREFIXES,
} from './constants/preview.constants';
import type { PreviewAliases } from './preview.interface';

@Injectable()
export class PreviewAnonymizer {
  createAliases(): PreviewAliases {
    return {
      users: new Map(),
      projects: new Map(),
      labels: new Map(),
      statuses: new Map(),
      branches: new Map(),
      commits: new Map(),
      commitTitles: new Map(),
    };
  }

  anonymizeDay(day: GroupedDailyData, aliases: PreviewAliases): GroupedDailyData {
    return {
      projects: day.projects.map((project) => this.anonymizeProject(project, aliases)),
      issues: day.issues.map((issue) => this.anonymizeIssue(issue, aliases)),
      standaloneMergeRequests: day.standaloneMergeRequests.map((mergeRequest) =>
        this.anonymizeMergeRequest(mergeRequest, aliases),
      ),
      standalonePushes: day.standalonePushes.map((push) => ({
        projectId: this.toProjectId(push.projectId, aliases),
        branch: this.toBranch(push.branch, aliases),
        events: push.events.map((event) => this.anonymizeEvent(event, aliases)),
      })),
    };
  }

  toUser(username: string, aliases: PreviewAliases) {
    return this.toAlias(aliases.users, username, PREVIEW_USER_ALIAS);
  }

  private anonymizeProject(project: SourceProject, aliases: PreviewAliases): SourceProject {
    const id = this.toProjectId(project.id, aliases);
    const path = this.toProjectPath(id);
    return {
      id,
      name: `${PREVIEW_PROJECT_ALIAS}-${id}`,
      path,
      webUrl: `${PREVIEW_URL}/${path}`,
    };
  }

  private anonymizeIssue(issue: GroupedIssue, aliases: PreviewAliases): GroupedIssue {
    const projectId = this.toProjectId(issue.projectId, aliases);
    return {
      projectId,
      iid: issue.iid,
      title: `${PREVIEW_ISSUE_TITLE} ${issue.iid}`,
      state: issue.state,
      closedOnReportDate: issue.closedOnReportDate,
      webUrl: this.toItemUrl(projectId, PREVIEW_ISSUES_PATH, issue.iid),
      labels: issue.labels.map((label) => this.toLabel(label, aliases)),
      createdAt: issue.createdAt,
      assignees: issue.assignees.map((username) => this.toUser(username, aliases)),
      status: issue.status && this.toStatus(issue.status, aliases),
      actions: issue.actions.map((action) => this.anonymizeAction(action, aliases)),
      events: issue.events.map((event) => this.anonymizeEvent(event, aliases)),
      notes: issue.notes.map((note) => this.anonymizeNote(note, aliases)),
      labelEvents: issue.labelEvents.map((event) => ({
        id: event.id,
        labelName: this.toLabel(event.labelName, aliases),
        action: event.action,
        createdAt: event.createdAt,
        username: this.toUser(event.username, aliases),
      })),
      mergeRequests: issue.mergeRequests.map((mergeRequest) =>
        this.anonymizeMergeRequest(mergeRequest, aliases),
      ),
    };
  }

  private anonymizeMergeRequest(
    mergeRequest: GroupedMergeRequest,
    aliases: PreviewAliases,
  ): GroupedMergeRequest {
    const projectId = this.toProjectId(mergeRequest.projectId, aliases);
    return {
      projectId,
      iid: mergeRequest.iid,
      title: `${PREVIEW_MERGE_REQUEST_TITLE} ${mergeRequest.iid}`,
      state: mergeRequest.state,
      mergedOnReportDate: mergeRequest.mergedOnReportDate,
      draft: mergeRequest.draft,
      webUrl: this.toItemUrl(projectId, PREVIEW_MERGE_REQUESTS_PATH, mergeRequest.iid),
      sourceBranch: this.toBranch(mergeRequest.sourceBranch, aliases),
      labels: mergeRequest.labels.map((label) => this.toLabel(label, aliases)),
      createdAt: mergeRequest.createdAt,
      lastCommitAt: mergeRequest.lastCommitAt,
      author: mergeRequest.author && this.toUser(mergeRequest.author, aliases),
      assignees: mergeRequest.assignees.map((username) => this.toUser(username, aliases)),
      reviewers: mergeRequest.reviewers.map((username) => this.toUser(username, aliases)),
      closesIssues: mergeRequest.closesIssues.map((issue) => {
        const issueProjectId = this.toProjectId(issue.projectId, aliases);
        return {
          projectId: issueProjectId,
          iid: issue.iid,
          title: `${PREVIEW_ISSUE_TITLE} ${issue.iid}`,
          webUrl: this.toItemUrl(issueProjectId, PREVIEW_ISSUES_PATH, issue.iid),
        };
      }),
      actions: mergeRequest.actions.map((action) => this.anonymizeAction(action, aliases)),
      events: mergeRequest.events.map((event) => this.anonymizeEvent(event, aliases)),
      notes: mergeRequest.notes.map((note) => this.anonymizeNote(note, aliases)),
      labelEvents: mergeRequest.labelEvents.map((event) => ({
        id: event.id,
        labelName: this.toLabel(event.labelName, aliases),
        action: event.action,
        createdAt: event.createdAt,
        username: this.toUser(event.username, aliases),
      })),
      reviewThreads: mergeRequest.reviewThreads,
    };
  }

  private anonymizeAction(action: SourceAction, aliases: PreviewAliases): SourceAction {
    return {
      kind: action.kind,
      at: action.at,
      value: action.value && this.toActionValue(action.kind, action.value, aliases),
      users: action.users.map((username) => this.toUser(username, aliases)),
    };
  }

  private anonymizeEvent(event: CleanEvent, aliases: PreviewAliases): CleanEvent {
    const anonymized: CleanEvent = {
      id: event.id,
      projectId: event.projectId === null ? null : this.toProjectId(event.projectId, aliases),
      actionName: event.actionName,
      targetType: event.targetType,
      targetTitle: event.targetTitle === null ? null : PREVIEW_TARGET_TITLE,
      createdAt: event.createdAt,
    };
    if (event.pushData) {
      anonymized.pushData = this.anonymizePushData(event.pushData, aliases);
    }
    if (event.noteBody !== undefined) {
      anonymized.noteBody = PREVIEW_COMMENT;
    }
    return anonymized;
  }

  private anonymizePushData(pushData: CleanPushData, aliases: PreviewAliases): CleanPushData {
    return {
      commitCount: pushData.commitCount,
      action: pushData.action,
      refType: pushData.refType,
      ref: pushData.ref && this.toBranch(pushData.ref, aliases),
      commitTitle: pushData.commitTitle && this.toCommitTitle(pushData.commitTitle, aliases),
      commits: pushData.commits.map((commit) => ({
        id: this.toAlias(aliases.commits, commit.id, PREVIEW_COMMIT_ALIAS),
        title: this.toCommitTitle(commit.title, aliases),
      })),
    };
  }

  private anonymizeNote(note: CleanNote, aliases: PreviewAliases): CleanNote {
    const author = this.toUser(note.authorUsername, aliases);
    const anonymized: CleanNote = {
      id: note.id,
      body: note.system ? this.toSystemNoteBody(note.body, aliases) : PREVIEW_COMMENT,
      authorUsername: author,
      authorName: author,
      createdAt: note.createdAt,
      system: note.system,
      noteableType: note.noteableType,
      resolvable: note.resolvable,
    };
    if (note.resolved !== undefined) {
      anonymized.resolved = note.resolved;
    }
    return anonymized;
  }

  private toSystemNoteBody(body: string, aliases: PreviewAliases) {
    const status = PREVIEW_STATUS_NOTE_PATTERN.exec(body);
    if (status) {
      return `set status to **${this.toStatus(status[1], aliases)}**`;
    }
    const branch = PREVIEW_BRANCH_NOTE_PATTERN.exec(body);
    if (branch) {
      return `created branch [\`${this.toBranch(branch[1], aliases)}\`](${PREVIEW_URL})`;
    }
    if (PREVIEW_TITLE_NOTE_PATTERN.test(body)) {
      return PREVIEW_TITLE_NOTE;
    }
    if (PREVIEW_USER_NOTE_PREFIXES.some((prefix) => body.startsWith(prefix))) {
      return body.replace(
        GITLAB_SOURCE_MENTION_PATTERN,
        (_mention, username: string) => `@${this.toUser(username, aliases)}`,
      );
    }
    return PREVIEW_NOTE_PREFIXES.find((prefix) => body.startsWith(prefix)) ?? PREVIEW_SYSTEM_NOTE;
  }

  private toActionValue(kind: SourceActionKind, value: string, aliases: PreviewAliases) {
    switch (kind) {
      case SourceActionKind.LABEL_ADDED:
      case SourceActionKind.LABEL_REMOVED:
        return this.toLabel(value, aliases);
      case SourceActionKind.STATUS_SET:
        return this.toStatus(value, aliases);
      case SourceActionKind.BRANCH_CREATED:
        return this.toBranch(value, aliases);
      default:
        return PREVIEW_ACTION_VALUE;
    }
  }

  private toLabel(label: string, aliases: PreviewAliases) {
    const key = toSourceKey(label);
    return PREVIEW_KEPT_LABELS.has(key)
      ? label
      : this.toAlias(aliases.labels, key, PREVIEW_LABEL_ALIAS);
  }

  private toStatus(status: string, aliases: PreviewAliases) {
    return PREVIEW_KEPT_STATUSES.has(status)
      ? status
      : this.toAlias(aliases.statuses, status, PREVIEW_STATUS_ALIAS);
  }

  private toBranch(branch: string, aliases: PreviewAliases) {
    if (GITLAB_SOURCE_MAIN_BRANCHES.has(branch)) {
      return branch;
    }
    const known = aliases.branches.get(branch);
    if (known) {
      return known;
    }
    const prefix =
      GITLAB_SOURCE_BRANCH_ISSUE_PATTERN.exec(branch)?.[0] ??
      PREVIEW_BOT_BRANCH_PATTERN.exec(branch)?.[0] ??
      '';
    const alias = `${prefix}${PREVIEW_BRANCH_ALIAS}-${aliases.branches.size + 1}`;
    aliases.branches.set(branch, alias);
    return alias;
  }

  private toCommitTitle(title: string, aliases: PreviewAliases) {
    const known = aliases.commitTitles.get(title);
    if (known) {
      return known;
    }
    const prefix = PREVIEW_TEST_COMMIT_PATTERN.test(title)
      ? PREVIEW_TEST_COMMIT_PREFIX
      : PREVIEW_RU_TEST_COMMIT_PATTERN.test(title)
        ? PREVIEW_RU_TEST_COMMIT_PREFIX
        : '';
    const alias = `${prefix}${PREVIEW_COMMIT_TITLE} ${aliases.commitTitles.size + 1}`;
    aliases.commitTitles.set(title, alias);
    return alias;
  }

  private toProjectId(projectId: number, aliases: PreviewAliases) {
    const known = aliases.projects.get(projectId);
    if (known) {
      return known;
    }
    const alias = aliases.projects.size + 1;
    aliases.projects.set(projectId, alias);
    return alias;
  }

  private toProjectPath(projectId: number) {
    return `${PREVIEW_GROUP}/${PREVIEW_PROJECT_ALIAS}-${projectId}`;
  }

  private toItemUrl(projectId: number, path: string, iid: number) {
    return `${PREVIEW_URL}/${this.toProjectPath(projectId)}/-/${path}/${iid}`;
  }

  private toAlias(map: Map<string, string>, key: string, prefix: string) {
    const known = map.get(key);
    if (known) {
      return known;
    }
    const alias = `${prefix}-${map.size + 1}`;
    map.set(key, alias);
    return alias;
  }
}
