import { describe, expect, it } from 'vitest';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import type { GroupedIssue } from 'src/modules/application/source/types/source-day.interface';
import { EngagementLevel } from '../types/activity.enums';
import {
  at,
  createIssue,
  fact,
  issueLine,
  OTHER,
  othersMergeRequest,
  pushEvent,
  toSignals,
} from './activity.fixture';

function engagement(overrides: Partial<GroupedIssue>) {
  return toSignals(issueLine(createIssue({ assignees: [OTHER], ...overrides }))).engagement;
}

function commits(count: number) {
  return othersMergeRequest({
    events: [
      pushEvent(
        at(11),
        Array.from({ length: count }, (_, index) => `fix: step ${index}`),
      ),
    ],
  });
}

describe('ActivityEngagement', () => {
  it('scores a helper by commits, comments and state changes', () => {
    const helper = othersMergeRequest({
      facts: [fact(SourceActionKind.COMMENTED, at(10))],
      events: [pushEvent(at(11), ['fix: a', 'fix: b'])],
    });

    expect(engagement({ mergeRequests: [helper] })).toBe(EngagementLevel.SECONDARY);
    expect(engagement({ facts: [fact(SourceActionKind.COMMENTED, at(10))] })).toBe(
      EngagementLevel.MINOR,
    );
    expect(engagement({})).toBe(EngagementLevel.OBSERVER);
  });

  it('caps commits, comments and state changes', () => {
    const states = ['status::doing', 'status::review', 'status::ready for qa', 'status::qa passed'];

    expect(
      engagement({
        facts: [
          ...Array.from({ length: 20 }, (_, minute) =>
            fact(SourceActionKind.COMMENTED, at(9, minute)),
          ),
          ...states.map((value, index) =>
            fact(SourceActionKind.LABEL_ADDED, at(12 + index), { value }),
          ),
        ],
        mergeRequests: [commits(3)],
      }),
    ).toBe(EngagementLevel.PRIMARY);
    expect(engagement({ mergeRequests: [commits(9)] })).toBe(EngagementLevel.PRIMARY);
    expect(engagement({ mergeRequests: [commits(4)] })).toBe(EngagementLevel.SECONDARY);
  });

  it('counts an approver as a reviewer', () => {
    expect(
      engagement({
        mergeRequests: [othersMergeRequest({ facts: [fact(SourceActionKind.APPROVED, at(12))] })],
      }),
    ).toBe(EngagementLevel.PRIMARY);
  });
});
