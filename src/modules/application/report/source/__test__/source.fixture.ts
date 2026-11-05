import { GitLabState } from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabAuthor,
  GitLabCommit,
  GitLabEvent,
  GitLabIssue,
  GitLabLabelEvent,
  GitLabMergeRequest,
  GitLabNote,
  GitLabProject,
  GitLabStateEvent,
} from 'src/modules/vendors/gitlab/gitlab.interface';

export const REPORT_DATE = '2026-08-02';

export const PROJECT_ID = 1;

export function createAuthor(username: string): GitLabAuthor {
  return { id: username.length, username, name: username };
}

export function createProject(
  overrides: Partial<GitLabProject> = {},
): GitLabProject {
  return {
    id: PROJECT_ID,
    name: 'backend',
    path_with_namespace: 'team/backend',
    web_url: 'https://gitlab.example.com/team/backend',
    default_branch: 'main',
    ...overrides,
  };
}

export function createEvent(overrides: Partial<GitLabEvent> = {}): GitLabEvent {
  return {
    id: 1,
    project_id: PROJECT_ID,
    action_name: 'opened',
    target_type: null,
    target_iid: null,
    target_title: null,
    created_at: `${REPORT_DATE}T10:00:00.000Z`,
    ...overrides,
  };
}

export function createIssue(overrides: Partial<GitLabIssue> = {}): GitLabIssue {
  return {
    iid: 12,
    project_id: PROJECT_ID,
    title: 'Fix the login',
    state: GitLabState.OPENED,
    labels: [],
    web_url: 'https://gitlab.example.com/team/backend/-/issues/12',
    created_at: '2026-07-20T09:00:00.000Z',
    assignee: null,
    ...overrides,
  };
}

export function createMergeRequest(
  overrides: Partial<GitLabMergeRequest> = {},
): GitLabMergeRequest {
  return {
    iid: 5,
    project_id: PROJECT_ID,
    title: 'feat: something useful',
    state: GitLabState.MERGED,
    labels: [],
    web_url: 'https://gitlab.example.com/team/backend/-/merge_requests/5',
    created_at: `${REPORT_DATE}T09:00:00.000Z`,
    source_branch: 'feature/x',
    author: createAuthor('dev.author'),
    assignee: null,
    reviewers: [],
    ...overrides,
  };
}

export function createNote(overrides: Partial<GitLabNote> = {}): GitLabNote {
  return {
    id: 1,
    body: '',
    author: createAuthor('dev.author'),
    created_at: `${REPORT_DATE}T10:00:00.000Z`,
    system: true,
    noteable_type: 'MergeRequest',
    resolvable: false,
    ...overrides,
  };
}

export function createLabelEvent(
  overrides: Partial<GitLabLabelEvent> = {},
): GitLabLabelEvent {
  return {
    id: 1,
    user: createAuthor('dev.author'),
    created_at: `${REPORT_DATE}T11:00:00.000Z`,
    label: { name: 'status::doing' },
    action: 'add',
    ...overrides,
  };
}

export function createStateEvent(
  state: GitLabState,
  createdAt: string,
): GitLabStateEvent {
  return { id: 1, created_at: createdAt, state };
}

export function createCommit(committedDate: string): GitLabCommit {
  return { id: committedDate, created_at: committedDate };
}
