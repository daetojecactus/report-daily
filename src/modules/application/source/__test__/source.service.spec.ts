import { describe, expect, it } from 'vitest';
import {
  at,
  createIssue,
  createMergeRequest,
  fact,
} from 'src/modules/application/report/activity/__test__/activity.fixture';
import type { GitLabSourceService } from '../gitlab/gitlab-source.service';
import { SourceActionKind } from '../source.enums';
import { SourceService } from '../source.service';

describe('SourceService', () => {
  const service = new SourceService({} as GitLabSourceService);

  it('finds every label and Status name of the day once', () => {
    const mergeRequest = createMergeRequest({
      labels: ['team::web'],
      startOfDay: { ...createMergeRequest().startOfDay, labels: ['review'] },
    });
    const issue = createIssue({
      labels: ['team::web', 'bug'],
      status: 'In progress',
      startOfDay: { ...createIssue().startOfDay, labels: ['bug'], status: 'To do' },
      facts: [
        fact(SourceActionKind.LABEL_ADDED, at(10), { value: 'blocked' }),
        fact(SourceActionKind.LABEL_REMOVED, at(11), { value: 'blocked' }),
        fact(SourceActionKind.STATUS_SET, at(12), { value: 'Waiting' }),
        fact(SourceActionKind.COMMENTED, at(13), { value: 'not a name' }),
      ],
      mergeRequests: [mergeRequest],
    });

    expect(
      service.findNames({
        projects: [],
        issues: [issue],
        standaloneMergeRequests: [createMergeRequest({ iid: 8, labels: ['dependencies'] })],
        standalonePushes: [],
        standaloneEvents: [],
      }),
    ).toEqual([
      'team::web',
      'bug',
      'In progress',
      'To do',
      'blocked',
      'Waiting',
      'review',
      'dependencies',
    ]);
  });
});
