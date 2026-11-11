import { Injectable } from '@nestjs/common';
import type {
  GitLabIssue,
  GitLabMergeRequest,
} from 'src/modules/vendors/gitlab/types/gitlab-issue.interface';
import type { GitLabProject } from 'src/modules/vendors/gitlab/types/gitlab.interface';
import {
  GITLAB_SOURCE_BRANCH_ISSUE_PATTERN,
  GITLAB_SOURCE_ISSUE_REFERENCE_PATTERN,
  GITLAB_SOURCE_KEY_SEPARATOR,
  GITLAB_SOURCE_MAIN_BRANCHES,
  GITLAB_SOURCE_PATH_SEPARATOR,
} from './constants/gitlab-source-keys.constants';
import type {
  SourceBranch,
  SourceItem,
  SourceRef,
  SourceTarget,
} from './types/gitlab-source.interface';

@Injectable()
export class GitLabSourceKeys {
  toKey(target: SourceItem | SourceBranch | SourceRef | SourceTarget) {
    const parts =
      'iid' in target
        ? [target.iid]
        : 'branch' in target
          ? [target.branch]
          : 'targetType' in target
            ? [target.targetType, target.id]
            : [target.refType, target.ref ?? ''];
    return [target.projectId, ...parts].join(GITLAB_SOURCE_KEY_SEPARATOR);
  }

  toItemKey(item: GitLabIssue | GitLabMergeRequest) {
    return this.toKey({ projectId: item.project_id, iid: item.iid });
  }

  toBranchKey(mergeRequest: GitLabMergeRequest) {
    return this.toKey({ projectId: mergeRequest.project_id, branch: mergeRequest.source_branch });
  }

  toBranchIssue(mergeRequest: GitLabMergeRequest): SourceItem | null {
    return this.toIssueOfBranch({
      projectId: mergeRequest.project_id,
      branch: mergeRequest.source_branch,
    });
  }

  toIssueOfBranch({ projectId, branch }: SourceBranch): SourceItem | null {
    const match = GITLAB_SOURCE_BRANCH_ISSUE_PATTERN.exec(branch);
    return match ? { projectId, iid: Number(match[1]) } : null;
  }

  toIssueReferences(body: string, projectPath: string) {
    const namespace = projectPath.split(GITLAB_SOURCE_PATH_SEPARATOR).slice(0, -1);
    return [...body.matchAll(GITLAB_SOURCE_ISSUE_REFERENCE_PATTERN)].map(([, path, iid]) => ({
      path: !path
        ? projectPath
        : path.includes(GITLAB_SOURCE_PATH_SEPARATOR)
          ? path
          : [...namespace, path].join(GITLAB_SOURCE_PATH_SEPARATOR),
      iid: Number(iid),
    }));
  }

  isWorkBranch({ projectId, branch }: SourceBranch, projects: Map<number, GitLabProject>) {
    return (
      !GITLAB_SOURCE_MAIN_BRANCHES.has(branch) && projects.get(projectId)?.default_branch !== branch
    );
  }
}
