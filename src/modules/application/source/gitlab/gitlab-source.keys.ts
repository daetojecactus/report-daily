import { Injectable } from '@nestjs/common';
import type {
  GitLabIssue,
  GitLabMergeRequest,
  GitLabProject,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import {
  GITLAB_SOURCE_BRANCH_ISSUE_PATTERN,
  GITLAB_SOURCE_KEY_SEPARATOR,
  GITLAB_SOURCE_MAIN_BRANCHES,
} from './constants/gitlab-source.constants';
import type { SourceBranch, SourceItem } from './gitlab-source.interface';

@Injectable()
export class GitLabSourceKeys {
  toKey(target: SourceItem | SourceBranch) {
    return [target.projectId, 'iid' in target ? target.iid : target.branch].join(
      GITLAB_SOURCE_KEY_SEPARATOR,
    );
  }

  toItemKey(item: GitLabIssue | GitLabMergeRequest) {
    return this.toKey({ projectId: item.project_id, iid: item.iid });
  }

  toBranchKey(mergeRequest: GitLabMergeRequest) {
    return this.toKey({ projectId: mergeRequest.project_id, branch: mergeRequest.source_branch });
  }

  toBranchIssue(mergeRequest: GitLabMergeRequest): SourceItem | null {
    const match = GITLAB_SOURCE_BRANCH_ISSUE_PATTERN.exec(mergeRequest.source_branch);
    return match ? { projectId: mergeRequest.project_id, iid: Number(match[1]) } : null;
  }

  isWorkBranch({ projectId, branch }: SourceBranch, projects: Map<number, GitLabProject>) {
    return (
      !GITLAB_SOURCE_MAIN_BRANCHES.has(branch) && projects.get(projectId)?.default_branch !== branch
    );
  }
}
