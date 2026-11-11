import { Injectable, Logger } from '@nestjs/common';
import { GitLabRefType, GitLabTargetType } from 'src/modules/vendors/gitlab/types/gitlab.enums';
import type { GitLabEvent } from 'src/modules/vendors/gitlab/types/gitlab.interface';
import {
  GITLAB_SOURCE_ISSUE_TARGET_TYPES,
  GITLAB_SOURCE_KNOWN_EVENTS,
  GITLAB_SOURCE_PROJECT_TARGET_TYPES,
  GITLAB_SOURCE_REF_TYPES,
} from './constants/gitlab-source.constants';
import { GitLabSourceMessages } from './constants/gitlab-source.messages';
import type {
  SourceBranch,
  SourceEventGroups,
  SourceEvents,
  SourceItem,
  SourceRef,
  SourceTarget,
} from './types/gitlab-source.interface';
import { GitLabSourceKeys } from './gitlab-source.keys';

@Injectable()
export class GitLabSourceEvents {
  private readonly logger = new Logger(GitLabSourceEvents.name);

  constructor(private readonly gitlabSourceKeys: GitLabSourceKeys) {}

  group(events: GitLabEvent[]): SourceEventGroups {
    const groups: SourceEventGroups = {
      issues: new Map(),
      mergeRequests: new Map(),
      pushes: new Map(),
      refs: new Map(),
      targets: new Map(),
    };
    for (const event of events) {
      const projectId = event.project_id;
      const type = event.note?.noteable_type ?? event.target_type;
      const iid = event.note?.noteable_iid ?? event.target_iid;
      const push = event.push_data;
      const targetType =
        event.target_type && GITLAB_SOURCE_PROJECT_TARGET_TYPES.get(event.target_type);
      if (projectId === null) {
        this.logUnknown(event);
      } else if (iid !== null && type !== null && GITLAB_SOURCE_ISSUE_TARGET_TYPES.has(type)) {
        this.addEvent(groups.issues, { projectId, iid }, event);
      } else if (iid !== null && type === GitLabTargetType.MERGE_REQUEST) {
        this.addEvent(groups.mergeRequests, { projectId, iid }, event);
      } else if (push?.ref && push.ref_type === GitLabRefType.BRANCH) {
        this.addEvent(groups.pushes, { projectId, branch: push.ref }, event);
      } else if (push) {
        const refType = GITLAB_SOURCE_REF_TYPES[push.ref_type];
        this.addEvent(groups.refs, { projectId, ref: push.ref, refType }, event);
      } else if (targetType && !event.note) {
        const title = event.target_title ?? '';
        const id = event.target_id ?? event.target_iid ?? title;
        this.addEvent(groups.targets, { projectId, targetType, id, title }, event);
      } else {
        this.logUnknown(event);
      }
    }
    return groups;
  }

  addTarget(groups: Map<string, SourceEvents<SourceItem>>, target: SourceItem) {
    const key = this.gitlabSourceKeys.toKey(target);
    if (!groups.has(key)) {
      groups.set(key, { target, events: [] });
    }
  }

  private logUnknown(event: GitLabEvent) {
    if (!GITLAB_SOURCE_KNOWN_EVENTS.has(event.action_name)) {
      this.logger.warn(
        {
          actionName: event.action_name,
          targetType: event.note?.noteable_type ?? event.target_type,
        },
        GitLabSourceMessages.UNKNOWN_EVENT,
      );
    }
  }

  private addEvent<T extends SourceItem | SourceBranch | SourceRef | SourceTarget>(
    groups: Map<string, SourceEvents<T>>,
    target: T,
    event: GitLabEvent,
  ) {
    const key = this.gitlabSourceKeys.toKey(target);
    const group = groups.get(key) ?? { target, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
}
