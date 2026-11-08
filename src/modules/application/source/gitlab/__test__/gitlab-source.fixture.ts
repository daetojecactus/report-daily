import { GitLabLabelAction, GitLabState } from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabAuthor,
  GitLabCommit,
  GitLabEvent,
  GitLabIssue,
  GitLabIterationEvent,
  GitLabLabelEvent,
  GitLabMergeRequest,
  GitLabMilestoneEvent,
  GitLabNote,
  GitLabProject,
  GitLabStateEvent,
  GitLabWeightEvent,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import { GitLabSourceBuilder } from '../gitlab-source.builder';
import { GitLabSourceFacts } from '../gitlab-source.facts';
import { GitLabSourceHistory } from '../gitlab-source.history';
import { GitLabSourceNotes } from '../gitlab-source.notes';

export const REPORT_DATE = '2026-08-02';

export const PROJECT_ID = 1;

const authorIds = new Map<string, number>();

export function createAuthor(username: string): GitLabAuthor {
  if (!authorIds.has(username)) {
    authorIds.set(username, authorIds.size + 1);
  }
  return { id: authorIds.get(username) ?? 0, username, name: username };
}

export function createProject(overrides: Partial<GitLabProject> = {}): GitLabProject {
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
    assignees: [],
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
    target_branch: 'main',
    sha: 'head-sha',
    merge_commit_sha: null,
    squash_commit_sha: null,
    draft: false,
    author: createAuthor('dev.author'),
    assignees: [],
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

export function createLabelEvent(overrides: Partial<GitLabLabelEvent> = {}): GitLabLabelEvent {
  return {
    id: 1,
    user: createAuthor('dev.author'),
    created_at: `${REPORT_DATE}T11:00:00.000Z`,
    label: { name: 'status::doing' },
    action: GitLabLabelAction.ADD,
    ...overrides,
  };
}

export function createMilestoneEvent(
  overrides: Partial<GitLabMilestoneEvent> = {},
): GitLabMilestoneEvent {
  return {
    id: 1,
    user: createAuthor('dev.author'),
    created_at: `${REPORT_DATE}T11:00:00.000Z`,
    milestone: { id: 3, title: '17.5' },
    action: GitLabLabelAction.ADD,
    ...overrides,
  };
}

export function createIterationEvent(
  overrides: Partial<GitLabIterationEvent> = {},
): GitLabIterationEvent {
  return {
    id: 1,
    user: createAuthor('dev.author'),
    created_at: `${REPORT_DATE}T11:00:00.000Z`,
    iteration: {
      id: 4,
      sequence: 3,
      title: null,
      start_date: '2026-07-27',
      due_date: '2026-08-09',
    },
    action: GitLabLabelAction.ADD,
    ...overrides,
  };
}

export function createWeightEvent(overrides: Partial<GitLabWeightEvent> = {}): GitLabWeightEvent {
  return {
    id: 1,
    user: createAuthor('dev.author'),
    created_at: `${REPORT_DATE}T11:00:00.000Z`,
    weight: 3,
    ...overrides,
  };
}

export function createStateEvent(state: GitLabState, createdAt: string): GitLabStateEvent {
  return { id: 1, created_at: createdAt, state };
}

export function createCommit(committedDate: string, title = 'feat: something'): GitLabCommit {
  return { id: committedDate, title, created_at: committedDate };
}

export function createBuilder() {
  const notes = new GitLabSourceNotes();
  return new GitLabSourceBuilder(new GitLabSourceHistory(notes), new GitLabSourceFacts(notes));
}
