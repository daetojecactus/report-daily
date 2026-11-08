import { describe, expect, it } from 'vitest';
import { ItemState, SourceActionKind } from 'src/modules/application/source/source.enums';
import type { SourceFact } from 'src/modules/application/source/source.interface';
import { JobRole } from 'src/modules/application/user/user.enums';
import { ActivityAction, ActivityDetail, ActivityRule } from '../activity.enums';
import {
  at,
  choose,
  createIndex,
  createIssue,
  createService,
  detect,
  fact,
  issueLine,
  ME,
  otherFact,
  summarize,
  toSignals,
} from './activity.fixture';

function actions(facts: SourceFact[]) {
  return summarize(detect(issueLine(createIssue({ facts })))).map(({ action, weight, details }) => [
    action,
    weight,
    details,
  ]);
}

function classify(facts: SourceFact[]) {
  const [result] = createService().classify(
    {
      projects: [],
      issues: [createIssue({ facts })],
      standaloneMergeRequests: [],
      standalonePushes: [],
      standaloneEvents: [],
    },
    { username: ME, role: JobRole.DEVELOPER },
    createIndex(),
  );
  return result;
}

describe('ActivityLinkDetector', () => {
  it('links issues in one action with every kind of the link', () => {
    expect(
      actions([
        fact(SourceActionKind.LINKED, at(10), { value: 'related to' }),
        fact(SourceActionKind.LINKED, at(10, 1), { value: 'blocking' }),
        fact(SourceActionKind.LINKED, at(10, 2), { value: 'blocked by' }),
        fact(SourceActionKind.LINKED, at(10, 3), { value: 'epic' }),
      ]),
    ).toEqual([
      [
        ActivityAction.LINKED,
        210,
        [
          ActivityDetail.RELATED,
          ActivityDetail.BLOCKING,
          ActivityDetail.BLOCKED_BY,
          ActivityDetail.PARENT,
        ],
      ],
    ]);
  });

  it('decomposes a task by adding child tasks and takes a removed link for an edit', () => {
    expect(actions([fact(SourceActionKind.CHILD_ADDED, at(10))])).toEqual([
      [ActivityAction.DECOMPOSED, 320, []],
    ]);
    expect(actions([fact(SourceActionKind.UNLINKED, at(10))])).toEqual([
      [ActivityAction.EDITED, 150, [ActivityDetail.LINKS]],
    ]);
  });

  it('takes a link right after creating the task for part of the creation', () => {
    expect(
      actions([
        fact(SourceActionKind.OPENED, at(10)),
        fact(SourceActionKind.LINKED, at(10, 1), { value: 'parent' }),
      ]),
    ).toEqual([[ActivityAction.CREATED, 220, []]]);
  });

  it('closes a duplicate and marks the original', () => {
    expect(
      actions([
        fact(SourceActionKind.DUPLICATE_MARKED, at(10)),
        fact(SourceActionKind.CLOSED, at(10)),
      ]),
    ).toEqual([[ActivityAction.CLOSED, 940, [ActivityDetail.DUPLICATE]]]);
    expect(actions([fact(SourceActionKind.LINKED, at(10), { value: 'duplicate' })])).toEqual([
      [ActivityAction.LINKED, 210, [ActivityDetail.DUPLICATE]],
    ]);
  });

  it('moves a task in with what GitLab copies and the employee sets up right away', () => {
    const line = issueLine(
      createIssue({
        facts: [
          fact(SourceActionKind.COMMENTED, at(9)),
          fact(SourceActionKind.MOVED_IN, at(15), { value: 'team/old#12' }),
          fact(SourceActionKind.LABEL_ADDED, at(15), { value: 'status::doing' }),
          fact(SourceActionKind.ASSIGNED, at(15, 1), { users: [ME] }),
          fact(SourceActionKind.DESCRIPTION_CHANGED, at(15, 2)),
          fact(SourceActionKind.COMMENTED, at(16)),
        ],
      }),
    );
    const signals = toSignals(line);

    expect(signals.own.map((item) => item.kind)).toEqual([
      SourceActionKind.MOVED_IN,
      SourceActionKind.COMMENTED,
    ]);
    expect(signals.dropped.map(({ rule }) => rule)).toEqual([
      ActivityRule.SETUP,
      ActivityRule.SETUP,
      ActivityRule.SETUP,
      ActivityRule.SETUP,
    ]);
    expect(choose(line).main).toMatchObject({ action: ActivityAction.MOVED, weight: 215 });
  });

  it('leaves the original out of the report when the move was all that happened to it', () => {
    const moveAway = [
      fact(SourceActionKind.MOVED_OUT, at(15), { value: 'team/new#3' }),
      fact(SourceActionKind.CLOSED, at(15)),
      fact(SourceActionKind.STATUS_SET, at(15), { value: 'Done' }),
      fact(SourceActionKind.LABEL_REMOVED, at(15, 0, 30), { value: 'status::doing' }),
    ];

    const moved = classify(moveAway);
    expect(moved.excluded).toBe(true);
    expect(moved.choice.main.action).toBe(ActivityAction.STATE_ONLY);
    expect(moved.signals.dropped.every(({ rule }) => rule === ActivityRule.MOVED_AWAY)).toBe(true);

    const commented = classify([fact(SourceActionKind.COMMENTED, at(10)), ...moveAway]);
    expect(commented.excluded).toBe(false);
    expect(commented.choice.main.action).toBe(ActivityAction.COMMENTED);
  });

  it('leaves out a line that only got the reply to a link made elsewhere', () => {
    const reply = fact(SourceActionKind.RECIPROCAL_LINK, at(10));

    const replied = classify([reply]);
    expect(replied.excluded).toBe(true);
    expect(replied.signals.dropped.map(({ rule }) => rule)).toEqual([ActivityRule.RECIPROCAL_LINK]);

    const commented = classify([fact(SourceActionKind.COMMENTED, at(9)), reply]);
    expect(commented.excluded).toBe(false);
    expect(commented.choice.main.action).toBe(ActivityAction.COMMENTED);
  });

  it('completes no task of the assignee that left by a move', () => {
    const closedByMove = (facts: SourceFact[]) =>
      summarize(
        detect(
          issueLine(
            createIssue({
              state: ItemState.CLOSED,
              closedOnReportDate: true,
              facts: [fact(SourceActionKind.COMMENTED, at(10)), ...facts],
            }),
          ),
        ),
      ).map(({ action }) => action);

    expect(
      closedByMove([
        otherFact(SourceActionKind.MOVED_OUT, at(15), { value: 'team/new#3' }),
        otherFact(SourceActionKind.CLOSED, at(15)),
      ]),
    ).toEqual([ActivityAction.COMMENTED]);
    expect(
      closedByMove([
        fact(SourceActionKind.MOVED_OUT, at(15), { value: 'team/new#3' }),
        fact(SourceActionKind.CLOSED, at(15)),
      ]),
    ).toEqual([ActivityAction.COMMENTED]);
    expect(closedByMove([otherFact(SourceActionKind.CLOSED, at(15))])).toContain(
      ActivityAction.COMPLETED,
    );
  });
});
