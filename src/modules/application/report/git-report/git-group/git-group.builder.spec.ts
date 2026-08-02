import { GitGroupBuilder } from './git-group.builder';
import type {
  GitLabMergeRequest,
  GitLabNote,
} from 'src/modules/vendors/gitlab/gitlab.interface';

const REPORT_DATE = '2026-08-02';
const USERNAME = 'qa.user';
const MR_KEY = '1_5';

function buildAuthor(username: string) {
  return {
    id: 1,
    username,
    name: username,
    state: 'active',
    avatar_url: '',
    web_url: '',
  };
}

function buildMergeRequest(
  overrides: Partial<GitLabMergeRequest> = {},
): GitLabMergeRequest {
  return {
    id: 100,
    iid: 5,
    title: 'feat: что-то полезное',
    description: '',
    state: 'merged',
    source_branch: 'feature/x',
    target_branch: 'main',
    project_id: 1,
    author: buildAuthor('dev.author'),
    labels: [],
    created_at: `${REPORT_DATE}T09:00:00.000Z`,
    updated_at: `${REPORT_DATE}T18:00:00.000Z`,
    user_notes_count: 0,
    web_url: 'https://gitlab.local/mr/5',
    has_conflicts: false,
    blocking_discussions_resolved: true,
    ...overrides,
  };
}

function buildNote(overrides: Partial<GitLabNote> = {}): GitLabNote {
  return {
    id: 1,
    type: null,
    body: '',
    author: buildAuthor('dev.author'),
    created_at: `${REPORT_DATE}T10:00:00.000Z`,
    updated_at: `${REPORT_DATE}T10:00:00.000Z`,
    system: true,
    noteable_id: 100,
    noteable_type: 'MergeRequest',
    noteable_iid: 5,
    project_id: 1,
    resolvable: false,
    ...overrides,
  };
}

function build(mr: GitLabMergeRequest, notes: GitLabNote[]) {
  return new GitGroupBuilder().buildGroupedData(
    [],
    new Map(),
    new Map([[MR_KEY, mr]]),
    new Map(),
    new Map(),
    new Map(),
    new Map([[MR_KEY, notes]]),
    new Map(),
    new Map(),
    new Map(),
    new Map(),
    REPORT_DATE,
  );
}

describe('GitGroupBuilder — ревьюеры мр', () => {
  it('текущие ревьюеры попадают в список', () => {
    const result = build(
      buildMergeRequest({ reviewers: [buildAuthor(USERNAME)] }),
      [],
    );

    expect(result.standaloneMergeRequests[0].reviewers).toContain(USERNAME);
  });

  it('проверяющий, снявший себя с мр, остаётся ревьюером по истории', () => {
    //после успешного ревью человек убирает себя из списка,
    //но системная заметка о запросе ревью в мр остаётся
    const result = build(buildMergeRequest({ reviewers: [] }), [
      buildNote({ body: `requested review from @${USERNAME}` }),
    ]);

    expect(result.standaloneMergeRequests[0].reviewers).toEqual([USERNAME]);
  });

  it('из одной заметки разбираются сразу несколько проверяющих', () => {
    const result = build(buildMergeRequest({ reviewers: [] }), [
      buildNote({ body: `requested review from @${USERNAME} and @dev.two` }),
    ]);

    expect(result.standaloneMergeRequests[0].reviewers).toEqual([
      USERNAME,
      'dev.two',
    ]);
  });

  it('обычный комментарий про ревью не делает человека ревьюером', () => {
    const result = build(buildMergeRequest({ reviewers: [] }), [
      buildNote({
        body: `посмотри ревью @${USERNAME}`,
        system: false,
        author: buildAuthor('dev.author'),
      }),
    ]);

    expect(result.standaloneMergeRequests[0].reviewers).toEqual([]);
  });

  it('треды ревью считаются по всем комментариям, а не только за день отчёта', () => {
    const result = build(buildMergeRequest(), [
      buildNote({
        id: 1,
        body: 'замечание позавчера',
        system: false,
        resolvable: true,
        resolved: true,
        created_at: '2026-07-31T10:00:00.000Z',
      }),
      buildNote({
        id: 2,
        body: 'ещё замечание',
        system: false,
        resolvable: true,
        resolved: false,
        created_at: '2026-07-31T11:00:00.000Z',
      }),
    ]);

    expect(result.standaloneMergeRequests[0].reviewThreads).toEqual({
      total: 2,
      unresolved: 1,
    });
  });
});
