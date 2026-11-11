import { Injectable } from '@nestjs/common';
import { toSourceKey } from 'src/common/utils/source-name.util';
import {
  GITLAB_SOURCE_BRANCH_ISSUE_PATTERN,
  GITLAB_SOURCE_COMMIT_MENTION_PATTERN,
  GITLAB_SOURCE_MAIN_BRANCHES,
} from 'src/modules/application/source/gitlab/constants/gitlab-source-keys.constants';
import { GITLAB_SOURCE_MENTION_PATTERN } from 'src/modules/application/source/gitlab/constants/gitlab-source-notes.constants';
import {
  ACTIVITY_CONVENTIONAL_DEPENDENCY_SCOPE,
  ACTIVITY_CONVENTIONAL_KINDS,
  ACTIVITY_CONVENTIONAL_PATTERN,
  ACTIVITY_VERSION_TAG_PATTERN,
} from 'src/modules/application/report/activity/constants/activity-patterns.constants';
import {
  SourceActionKind,
  SourceRefType,
  SourceTargetType,
} from 'src/modules/application/source/types/source.enums';
import type {
  CleanEvent,
  CleanNote,
  CleanPushData,
  SourceFact,
} from 'src/modules/application/source/types/source.interface';
import type {
  GroupedDailyData,
  GroupedIssue,
  GroupedMergeRequest,
  SourceProject,
  StandalonePush,
} from 'src/modules/application/source/types/source-day.interface';
import type {
  ItemSnapshot,
  MergeRequestSnapshot,
} from 'src/modules/application/source/types/source-snapshot.interface';
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
  PREVIEW_ITERATION_ALIAS,
  PREVIEW_KEPT_LABELS,
  PREVIEW_KEPT_STATUSES,
  PREVIEW_LABEL_ALIAS,
  PREVIEW_MERGE_REQUEST_TITLE,
  PREVIEW_MERGE_REQUESTS_PATH,
  PREVIEW_MILESTONE_ALIAS,
  PREVIEW_PAGE_ALIAS,
  PREVIEW_NOTE_PREFIXES,
  PREVIEW_PROJECT_ALIAS,
  PREVIEW_RU_TEST_COMMIT_MARKER,
  PREVIEW_RU_TEST_COMMIT_PATTERN,
  PREVIEW_STATUS_ALIAS,
  PREVIEW_STATUS_NOTE_PATTERN,
  PREVIEW_SYSTEM_NOTE,
  PREVIEW_TAG_ALIAS,
  PREVIEW_TAG_VERSION_PATTERN,
  PREVIEW_TARGET_TITLE,
  PREVIEW_TEST_COMMIT_MARKER,
  PREVIEW_TEST_COMMIT_PATTERN,
  PREVIEW_TITLE_NOTE,
  PREVIEW_TITLE_NOTE_PATTERN,
  PREVIEW_URL,
  PREVIEW_USER_ALIAS,
  PREVIEW_USER_NOTE_PREFIXES,
} from './constants/preview-anonymizer.constants';
import type { PreviewAliases } from './types/preview.interface';

@Injectable()
export class PreviewAnonymizer {
  createAliases(): PreviewAliases {
    return {
      users: new Map(),
      projects: new Map(),
      labels: new Map(),
      statuses: new Map(),
      branches: new Map(),
      tags: new Map(),
      milestones: new Map(),
      iterations: new Map(),
      pages: new Map(),
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
      standalonePushes: day.standalonePushes.map((push) => this.anonymizePush(push, aliases)),
      standaloneEvents: day.standaloneEvents.map((item) => ({
        projectId: this.toProjectId(item.projectId, aliases),
        targetType: item.targetType,
        title:
          item.targetType === SourceTargetType.MILESTONE
            ? this.toMilestone(item.title, aliases)
            : this.toAlias(aliases.pages, item.title, PREVIEW_PAGE_ALIAS),
        events: item.events.map((event) => this.anonymizeEvent(event, aliases)),
      })),
    };
  }

  private anonymizePush(push: StandalonePush, aliases: PreviewAliases): StandalonePush {
    return {
      projectId: this.toProjectId(push.projectId, aliases),
      ref: push.ref && this.toRef(push.ref, push.refType, aliases),
      refType: push.refType,
      mainBranch: push.mainBranch,
      events: push.events.map((event) => this.anonymizeEvent(event, aliases)),
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
      workItemType: issue.workItemType,
      labels: issue.labels.map((label) => this.toLabel(label, aliases)),
      createdAt: issue.createdAt,
      assignees: issue.assignees.map((username) => this.toUser(username, aliases)),
      status: issue.status && this.toStatus(issue.status, aliases),
      milestone: issue.milestone && this.toMilestone(issue.milestone, aliases),
      iteration: issue.iteration && this.toIteration(issue.iteration, aliases),
      weight: issue.weight,
      timeSpent: issue.timeSpent,
      startOfDay: {
        ...this.anonymizeSnapshot(issue.startOfDay, aliases),
        iteration:
          issue.startOfDay.iteration && this.toIteration(issue.startOfDay.iteration, aliases),
        weight: issue.startOfDay.weight,
      },
      facts: issue.facts.map((fact) => this.anonymizeFact(fact, aliases)),
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
      pushes: issue.pushes.map((push) => this.anonymizePush(push, aliases)),
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
      title: `${this.toConventionalPrefix(mergeRequest.title)}${PREVIEW_MERGE_REQUEST_TITLE} ${mergeRequest.iid}`,
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
      milestone: mergeRequest.milestone && this.toMilestone(mergeRequest.milestone, aliases),
      timeSpent: mergeRequest.timeSpent,
      startOfDay: {
        ...this.anonymizeSnapshot(mergeRequest.startOfDay, aliases),
        reviewers: mergeRequest.startOfDay.reviewers.map((username) =>
          this.toUser(username, aliases),
        ),
        draft: mergeRequest.startOfDay.draft,
      },
      facts: mergeRequest.facts.map((fact) => this.anonymizeFact(fact, aliases)),
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

  private anonymizeSnapshot(
    snapshot: ItemSnapshot | MergeRequestSnapshot,
    aliases: PreviewAliases,
  ): ItemSnapshot {
    return {
      state: snapshot.state,
      labels: snapshot.labels.map((label) => this.toLabel(label, aliases)),
      assignees: snapshot.assignees.map((username) => this.toUser(username, aliases)),
      status: snapshot.status && this.toStatus(snapshot.status, aliases),
      milestone: snapshot.milestone && this.toMilestone(snapshot.milestone, aliases),
    };
  }

  private anonymizeFact(fact: SourceFact, aliases: PreviewAliases): SourceFact {
    return {
      kind: fact.kind,
      at: fact.at,
      actor: fact.actor && this.toUser(fact.actor, aliases),
      own: fact.own,
      value: fact.value && this.toFactValue(fact.kind, fact.value, aliases),
      users: fact.users.map((username) => this.toUser(username, aliases)),
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
      ref: pushData.ref && this.toRef(pushData.ref, pushData.refType, aliases),
      refCount: pushData.refCount,
      commitTitle: pushData.commitTitle && this.toCommitTitle(pushData.commitTitle, aliases),
      commits: pushData.commits.map((commit) => ({
        id: this.toCommit(commit.id, aliases),
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
    const commit = GITLAB_SOURCE_COMMIT_MENTION_PATTERN.exec(body);
    if (commit) {
      return `mentioned in commit ${this.toCommit(commit[1], aliases)}`;
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

  private toFactValue(kind: SourceActionKind, value: string, aliases: PreviewAliases) {
    switch (kind) {
      case SourceActionKind.LABEL_ADDED:
      case SourceActionKind.LABEL_REMOVED:
        return this.toLabel(value, aliases);
      case SourceActionKind.STATUS_SET:
        return this.toStatus(value, aliases);
      case SourceActionKind.BRANCH_CREATED:
      case SourceActionKind.PUSHED:
        return this.toBranch(value, aliases);
      case SourceActionKind.MILESTONE_SET:
      case SourceActionKind.MILESTONE_REMOVED:
        return this.toMilestone(value, aliases);
      case SourceActionKind.ITERATION_SET:
      case SourceActionKind.ITERATION_REMOVED:
        return this.toIteration(value, aliases);
      case SourceActionKind.WEIGHT_SET:
      case SourceActionKind.WEIGHT_REMOVED:
      case SourceActionKind.LINKED:
      case SourceActionKind.DUE_DATE_SET:
      case SourceActionKind.DUE_DATE_REMOVED:
      case SourceActionKind.START_DATE_SET:
      case SourceActionKind.START_DATE_REMOVED:
        return value;
      case SourceActionKind.COMMIT_MENTIONED:
        return this.toCommit(value, aliases);
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

  private toCommit(id: string, aliases: PreviewAliases) {
    const known = [...aliases.commits.keys()].find(
      (key) => key.startsWith(id) || id.startsWith(key),
    );
    return this.toAlias(aliases.commits, known ?? id, PREVIEW_COMMIT_ALIAS);
  }

  private toMilestone(milestone: string, aliases: PreviewAliases) {
    return this.toAlias(aliases.milestones, milestone, PREVIEW_MILESTONE_ALIAS);
  }

  private toIteration(iteration: string, aliases: PreviewAliases) {
    return this.toAlias(aliases.iterations, iteration, PREVIEW_ITERATION_ALIAS);
  }

  private toRef(ref: string, refType: SourceRefType, aliases: PreviewAliases) {
    return refType === SourceRefType.TAG ? this.toTag(ref, aliases) : this.toBranch(ref, aliases);
  }

  private toTag(tag: string, aliases: PreviewAliases) {
    const version = ACTIVITY_VERSION_TAG_PATTERN.test(tag)
      ? PREVIEW_TAG_VERSION_PATTERN.exec(tag)?.[0]
      : undefined;
    return version ? `v${version}` : this.toAlias(aliases.tags, tag, PREVIEW_TAG_ALIAS);
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

  private toConventionalPrefix(title: string) {
    const match = ACTIVITY_CONVENTIONAL_PATTERN.exec(title);
    if (!match) {
      return '';
    }
    const [, type, scope] = match;
    if (scope && ACTIVITY_CONVENTIONAL_DEPENDENCY_SCOPE.test(scope)) {
      return `${type.toLowerCase()}(deps): `;
    }
    return ACTIVITY_CONVENTIONAL_KINDS.has(type.toLowerCase()) ? `${type.toLowerCase()}: ` : '';
  }

  private toCommitTitle(title: string, aliases: PreviewAliases) {
    const known = aliases.commitTitles.get(title);
    if (known) {
      return known;
    }
    const marker = PREVIEW_TEST_COMMIT_PATTERN.test(title)
      ? PREVIEW_TEST_COMMIT_MARKER
      : PREVIEW_RU_TEST_COMMIT_PATTERN.test(title)
        ? PREVIEW_RU_TEST_COMMIT_MARKER
        : '';
    const alias = `${this.toConventionalPrefix(title)}${PREVIEW_COMMIT_TITLE} ${aliases.commitTitles.size + 1}${marker}`;
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
