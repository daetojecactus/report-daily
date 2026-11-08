import { describe, expect, it } from 'vitest';
import { GitLabSourceKeys } from '../gitlab-source.keys';

describe('GitLabSourceKeys', () => {
  const keys = new GitLabSourceKeys();

  it('resolves the issue references of a note against its project', () => {
    expect(
      keys.toIssueReferences(
        'marked this issue as related to #2, frontend#7 and other/api#9',
        'team/backend',
      ),
    ).toEqual([
      { path: 'team/backend', iid: 2 },
      { path: 'team/frontend', iid: 7 },
      { path: 'other/api', iid: 9 },
    ]);
  });
});
