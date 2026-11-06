import { describe, expect, it } from 'vitest';
import { WorkflowState } from 'src/modules/application/trait/trait.enums';
import { EngagementLevel, TaskRole } from '../classification.enums';
import { createContext, REPORT_DATE } from './classification.fixture';

describe('TaskContext', () => {
  it('scores the engagement of an assignee as primary', () => {
    expect(createContext().engagementLevel()).toBe(EngagementLevel.PRIMARY);
  });

  it('scores a helper by commits, comments and state changes', () => {
    const helper = createContext({
      taskRole: TaskRole.OBSERVER,
      activity: { mergeRequestCommitCount: 2, mergeRequestCommentsFromEmployee: 1 },
    });
    const minor = createContext({
      taskRole: TaskRole.OBSERVER,
      activity: { issueCommentsFromEmployee: 1 },
    });
    const observer = createContext({ taskRole: TaskRole.OBSERVER });

    expect(helper.engagementLevel()).toBe(EngagementLevel.SECONDARY);
    expect(helper.isSupportingContributor()).toBe(true);
    expect(minor.engagementLevel()).toBe(EngagementLevel.MINOR);
    expect(minor.isSupportingContributor()).toBe(true);
    expect(observer.engagementLevel()).toBe(EngagementLevel.OBSERVER);
    expect(observer.isSupportingContributor()).toBe(false);
  });

  it('caps commits, comments and state changes', () => {
    const context = createContext({
      taskRole: TaskRole.OBSERVER,
      activity: { mergeRequestCommitCount: 3, issueCommentsFromEmployee: 20 },
      traits: {
        statesSetByEmployee: [
          WorkflowState.IN_PROGRESS,
          WorkflowState.REVIEW,
          WorkflowState.READY_FOR_QA,
          WorkflowState.QA_PASSED,
        ],
      },
    });

    expect(context.engagementLevel()).toBe(EngagementLevel.PRIMARY);
    expect(
      createContext({
        taskRole: TaskRole.OBSERVER,
        activity: { mergeRequestCommitCount: 9 },
      }).engagementLevel(),
    ).toBe(EngagementLevel.PRIMARY);
    expect(
      createContext({
        taskRole: TaskRole.OBSERVER,
        activity: { mergeRequestCommitCount: 4 },
      }).engagementLevel(),
    ).toBe(EngagementLevel.SECONDARY);
  });

  it('compares the creation day of the merge request with the report date', () => {
    expect(
      createContext({
        dates: { mergeRequestCreatedAt: `${REPORT_DATE}T23:00:00.000Z` },
      }).isMergeRequestCreatedOnReportDate(),
    ).toBe(true);
    expect(
      createContext({
        dates: { mergeRequestCreatedAt: '2026-08-01T23:00:00.000Z' },
      }).isMergeRequestCreatedOnReportDate(),
    ).toBe(false);
  });

  it('sees resumed work after more than seven days without commits', () => {
    expect(
      createContext({
        dates: { mergeRequestLastCommitAt: '2026-07-25T00:00:00.000Z' },
      }).isResumedWork(),
    ).toBe(true);
    expect(
      createContext({
        dates: { mergeRequestLastCommitAt: '2026-07-26T00:00:00.000Z' },
      }).isResumedWork(),
    ).toBe(false);
  });

  it('sees a return to work from review, testing or the QA queue', () => {
    for (const previousState of [
      WorkflowState.REVIEW,
      WorkflowState.TESTING,
      WorkflowState.CHANGES_REQUESTED,
      WorkflowState.READY_FOR_QA,
    ]) {
      expect(
        createContext({
          traits: { currentState: WorkflowState.IN_PROGRESS, previousState },
        }).wasReturnedToDoing(),
      ).toBe(true);
    }
    expect(
      createContext({
        traits: {
          currentState: WorkflowState.IN_PROGRESS,
          previousState: WorkflowState.PLANNED,
        },
      }).wasReturnedToDoing(),
    ).toBe(false);
  });
});
