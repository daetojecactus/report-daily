import { describe, expect, it } from 'vitest';
import {
  SourceActionKind,
  SourceEventAction,
  SourceRefType,
} from 'src/modules/application/source/types/source.enums';
import type { SourceFact } from 'src/modules/application/source/types/source.interface';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { ActivityAction, ActivityDetail } from '../../types/activity.enums';
import {
  at,
  choose,
  createIssue,
  createMergeRequest,
  detect,
  fact,
  issueLine,
  pushLine,
  refEvent,
  summarize,
} from '../../__test__/activity.fixture';

function tagLine(ref: string | null, actionName = SourceEventAction.PUSHED_NEW) {
  return pushLine({
    ref,
    refType: SourceRefType.TAG,
    events: [
      refEvent(at(11), actionName, {
        refType: SourceRefType.TAG,
        ref,
        refCount: ref === null ? 6 : null,
      }),
    ],
  });
}

function deletedLine(refType: SourceRefType, ref: string | null) {
  return pushLine({
    ref,
    refType,
    events: [
      refEvent(at(11), SourceEventAction.DELETED, {
        action: 'removed',
        refType,
        ref,
        refCount: ref === null ? 4 : null,
      }),
    ],
  });
}

describe('ActivityRefDetector', () => {
  it('releases a version by a tag with a version number', () => {
    for (const tag of ['v1.4.0', 'release-2.3', 'pkg@1.2.0', '2026.11', 'v2', '1.0.0-rc.1']) {
      expect(summarize(detect(tagLine(tag))), tag).toEqual([
        { action: ActivityAction.RELEASED, weight: 930, state: null, details: [] },
      ]);
    }
  });

  it('puts any other tag without releasing a version', () => {
    for (const tag of ['prod', 'backup-before-migration', 'deploy', 'backup-1', 'dev2']) {
      expect(summarize(detect(tagLine(tag))), tag).toEqual([
        { action: ActivityAction.TAGGED, weight: 260, state: null, details: [] },
      ]);
    }
  });

  it('pushes many tags at once as tags, not as versions', () => {
    expect(summarize(detect(tagLine(null)))).toEqual([
      {
        action: ActivityAction.TAGGED,
        weight: 260,
        state: null,
        details: [ActivityDetail.MANY],
      },
    ]);
  });

  it('gives DevOps the role bonus for a release', () => {
    expect(choose(tagLine('v1.4.0'), JobRole.DEVOPS).trace.ranked[0].weight).toBe(960);
    expect(choose(tagLine('v1.4.0')).trace.ranked[0].weight).toBe(930);
  });

  it('deletes a branch, a tag and many branches at once', () => {
    const deleted = (refType: SourceRefType, ref: string | null) =>
      summarize(detect(deletedLine(refType, ref)));

    expect(deleted(SourceRefType.BRANCH, '12-login')).toEqual([
      { action: ActivityAction.DELETED, weight: 120, state: null, details: [] },
    ]);
    expect(deleted(SourceRefType.TAG, 'v1.4.0')[0].details).toEqual([ActivityDetail.TAG]);
    expect(deleted(SourceRefType.BRANCH, null)[0].details).toEqual([ActivityDetail.MANY]);
  });

  it('takes the deletion of a branch on an own merge for a part of the merge', () => {
    const removal = refEvent(at(15, 1), SourceEventAction.DELETED, { action: 'removed' });
    const actions = (facts: SourceFact[]) =>
      summarize(
        detect(
          issueLine(
            createIssue({ mergeRequests: [createMergeRequest({ facts, events: [removal] })] }),
          ),
        ),
      ).map(({ action }) => action);

    expect(actions([fact(SourceActionKind.MERGED, at(15))])).toEqual([ActivityAction.MERGED]);
    expect(actions([])).toEqual([ActivityAction.DELETED]);
  });
});
