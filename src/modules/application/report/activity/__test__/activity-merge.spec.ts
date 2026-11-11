import { describe, expect, it } from 'vitest';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import type { SourceFact } from 'src/modules/application/source/types/source.interface';
import { ActivityAction, ActivityDetail } from '../types/activity.enums';
import {
  at,
  choose,
  createIssue,
  createMergeRequest,
  detect,
  fact,
  issueLine,
  OTHER,
  otherFact,
  othersMergeRequest,
  summarize,
} from './activity.fixture';

function line(facts: SourceFact[], others = false) {
  return others
    ? issueLine(createIssue({ assignees: [OTHER], mergeRequests: [othersMergeRequest({ facts })] }))
    : issueLine(createIssue({ mergeRequests: [createMergeRequest({ facts })] }));
}

describe('auto-merge and requested changes', () => {
  it('sets a merge request to auto-merge as a transition', () => {
    expect(summarize(detect(line([fact(SourceActionKind.AUTO_MERGE_SET, at(10))])))).toEqual([
      { action: ActivityAction.MERGE_SCHEDULED, weight: 650, state: null, details: [] },
    ]);
  });

  it('takes auto-merge for part of a merge on the same day', () => {
    const choice = choose(
      line([
        fact(SourceActionKind.AUTO_MERGE_SET, at(10)),
        fact(SourceActionKind.MERGED, at(10, 20)),
      ]),
    );

    expect(choice.main).toMatchObject({
      action: ActivityAction.MERGED,
      details: expect.arrayContaining([ActivityDetail.AUTO_MERGE]) as unknown,
    });
    expect(choice.main.parts.map(({ action }) => action)).toEqual([ActivityAction.MERGE_SCHEDULED]);
  });

  it('takes a canceled auto-merge for an edit and one canceled at once for nothing', () => {
    expect(
      summarize(detect(line([fact(SourceActionKind.AUTO_MERGE_CANCELED, at(10))]))).map(
        ({ action, details }) => [action, details],
      ),
    ).toEqual([[ActivityAction.EDITED, [ActivityDetail.AUTO_MERGE]]]);
    expect(
      summarize(
        detect(
          line([
            fact(SourceActionKind.AUTO_MERGE_SET, at(10)),
            fact(SourceActionKind.AUTO_MERGE_CANCELED, at(10, 1)),
          ]),
        ),
      ),
    ).toEqual([]);
  });

  it('requests changes in a merge request of someone else as a review', () => {
    const [reviewed] = summarize(
      detect(
        line(
          [
            otherFact(SourceActionKind.COMMENTED, at(9)),
            fact(SourceActionKind.COMMENTED, at(10)),
            fact(SourceActionKind.CHANGES_REQUESTED, at(10, 1)),
          ],
          true,
        ),
      ),
    );

    expect(reviewed).toMatchObject({
      action: ActivityAction.REVIEWED,
      details: [ActivityDetail.CHANGES_REQUESTED],
    });
  });
});
