import { describe, expect, it } from 'vitest';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import type {
  SourceFact,
  SourceTextChange,
} from 'src/modules/application/source/types/source.interface';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { ActivityAction, ActivityDetail } from '../../types/activity.enums';
import {
  at,
  createIssue,
  createMergeRequest,
  detect,
  fact,
  issueLine,
  ME,
  OTHER,
  otherFact,
  summarize,
} from '../../__test__/activity.fixture';

describe('ActivityDiscussionDetector', () => {
  it('detects requirements, assignments, comments and a title edit', () => {
    const issue = createIssue({
      facts: [
        fact(SourceActionKind.DESCRIPTION_CHANGED, at(10)),
        fact(SourceActionKind.TITLE_CHANGED, at(11)),
        fact(SourceActionKind.ASSIGNED, at(12), { users: [OTHER] }),
        fact(SourceActionKind.COMMENTED, at(13)),
      ],
    });

    expect(summarize(detect(issueLine(issue), JobRole.SYSTEM_ANALYST))).toEqual([
      { action: ActivityAction.REQUIREMENTS, weight: 320, state: null, details: [] },
      { action: ActivityAction.ASSIGNED, weight: 200, state: null, details: [] },
      { action: ActivityAction.COMMENTED, weight: 100, state: null, details: [] },
      {
        action: ActivityAction.EDITED,
        weight: 150,
        state: null,
        details: [ActivityDetail.TITLE],
      },
    ]);
  });

  it('tells how big the description edits of the day were from the description history', () => {
    const edit = (...changes: SourceTextChange[]) =>
      summarize(
        detect(
          issueLine(
            createIssue({
              facts: changes.map((change, index) =>
                fact(SourceActionKind.DESCRIPTION_CHANGED, at(10 + index), { change }),
              ),
            }),
          ),
          JobRole.SYSTEM_ANALYST,
        ),
      )[0];

    expect(edit({ before: 0, added: 605, removed: 0 })).toEqual({
      action: ActivityAction.REQUIREMENTS,
      weight: 320,
      state: null,
      details: [ActivityDetail.WRITTEN],
    });
    expect(edit({ before: 55, added: 346, removed: 0 }).details).toEqual([ActivityDetail.WRITTEN]);
    expect(edit({ before: 494, added: 453, removed: 55 }).details).toEqual([
      ActivityDetail.EXPANDED,
    ]);
    expect(
      edit({ before: 2000, added: 192, removed: 1449 }, { before: 748, added: 53, removed: 0 })
        .details,
    ).toEqual([ActivityDetail.REWORKED]);
    expect(edit({ before: 1624, added: 5, removed: 0 })).toEqual({
      action: ActivityAction.REQUIREMENTS,
      weight: 160,
      state: null,
      details: [ActivityDetail.CORRECTED],
    });
    expect(edit({ before: 1024, added: 139, removed: 88 }).details).toEqual([
      ActivityDetail.CORRECTED,
    ]);
  });

  it('leaves the size out when GitLab gives no description history', () => {
    const issue = createIssue({ facts: [fact(SourceActionKind.DESCRIPTION_CHANGED, at(10))] });

    expect(summarize(detect(issueLine(issue)))).toEqual([
      { action: ActivityAction.REQUIREMENTS, weight: 320, state: null, details: [] },
    ]);
  });

  it('refines the requirements after a discussion in the issue', () => {
    const edit = fact(SourceActionKind.DESCRIPTION_CHANGED, at(10));
    const requirements = (issue: ReturnType<typeof createIssue>) =>
      summarize(detect(issueLine(issue), JobRole.SYSTEM_ANALYST))[0];

    expect(
      requirements(createIssue({ facts: [otherFact(SourceActionKind.COMMENTED, at(9)), edit] })),
    ).toMatchObject({
      action: ActivityAction.REQUIREMENTS,
      details: [ActivityDetail.AFTER_DISCUSSION],
    });
    expect(
      requirements(createIssue({ facts: [edit, otherFact(SourceActionKind.COMMENTED, at(11))] })),
    ).toMatchObject({ action: ActivityAction.REQUIREMENTS, details: [] });
  });

  it('tells who the task went to and who left it', () => {
    const assigned = (...facts: SourceFact[]) =>
      summarize(detect(issueLine(createIssue({ facts }))));
    const add = (users: string[], time = at(10)) =>
      fact(SourceActionKind.ASSIGNED, time, { users });
    const remove = (users: string[], time = at(10)) =>
      fact(SourceActionKind.UNASSIGNED, time, { users });

    expect(assigned(add([OTHER]))).toEqual([
      { action: ActivityAction.ASSIGNED, weight: 200, state: null, details: [] },
    ]);
    expect(assigned(add([ME]))[0].details).toEqual([ActivityDetail.TAKEN]);
    expect(assigned(remove([OTHER]), add([ME]))[0].details).toEqual([ActivityDetail.TAKEN]);
    expect(assigned(remove([ME]), add([OTHER]))[0].details).toEqual([ActivityDetail.HANDED_OVER]);
    expect(assigned(remove(['dev.third']), add([OTHER]))[0].details).toEqual([
      ActivityDetail.REASSIGNED,
    ]);
    expect(assigned(remove([ME]))[0].details).toEqual([ActivityDetail.LEFT]);
    expect(assigned(remove([OTHER]))[0].details).toEqual([ActivityDetail.UNASSIGNED]);
  });

  it('takes the last change of the assignees in a day', () => {
    const issue = createIssue({
      facts: [
        fact(SourceActionKind.UNASSIGNED, at(10), { users: [OTHER] }),
        fact(SourceActionKind.ASSIGNED, at(10), { users: [ME] }),
        fact(SourceActionKind.UNASSIGNED, at(15), { users: [ME] }),
        fact(SourceActionKind.ASSIGNED, at(15), { users: [OTHER] }),
      ],
    });

    expect(summarize(detect(issueLine(issue)))).toEqual([
      {
        action: ActivityAction.ASSIGNED,
        weight: 200,
        state: null,
        details: [ActivityDetail.HANDED_OVER],
      },
    ]);
  });

  it('discusses in an own merge request when others answer and there is no code', () => {
    const mergeRequest = createMergeRequest({
      facts: [
        otherFact(SourceActionKind.COMMENTED, at(9)),
        fact(SourceActionKind.COMMENTED, at(10)),
      ],
    });

    expect(
      summarize(detect({ issue: null, event: null, pushes: [], mergeRequests: [mergeRequest] })),
    ).toEqual([
      {
        action: ActivityAction.DISCUSSED,
        weight: 200,
        state: null,
        details: [ActivityDetail.DIALOG],
      },
    ]);
  });
});
