import { describe, expect, it } from 'vitest';
import { ItemState, SourceEventAction } from 'src/modules/application/source/source.enums';
import {
  Priority,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/trait.enums';
import { JobRole } from 'src/modules/application/user/user.enums';
import { ActivityAction, TaskRole } from '../classification.enums';
import { createContext, createResolver } from './classification.fixture';

const pushed = (commitTitles: string[] = []) => ({
  mergeRequestState: null,
  mergeRequestActions: [SourceEventAction.PUSHED_TO],
  mergeRequestCommitCount: commitTitles.length || 1,
  commitTitles,
});

describe('ClassificationResolver', () => {
  const resolver = createResolver();

  describe('ready for QA', () => {
    it('a developer who set the state sent the task to testing', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: {
          currentState: WorkflowState.READY_FOR_QA,
          statesSetByEmployee: [WorkflowState.READY_FOR_QA],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.TASK_SENT_TO_QA);
    });

    it('an assignee developer gets it when someone else set the state', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { activeStates: [WorkflowState.READY_FOR_QA] },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.TASK_SENT_TO_QA);
    });

    it('for QA the task joins the testing queue', () => {
      const context = createContext({
        role: JobRole.QA,
        taskRole: TaskRole.OBSERVER,
        traits: { currentState: WorkflowState.READY_FOR_QA },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_AWAITING_TESTING);
    });
  });

  describe('testing', () => {
    it('QA who took the task tests it', () => {
      const context = createContext({
        role: JobRole.QA,
        taskRole: TaskRole.OBSERVER,
        traits: {
          currentState: WorkflowState.TESTING,
          statesSetByEmployee: [WorkflowState.TESTING],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_IN_PROGRESS);
    });

    it('a QA reviewer who took the task tests it too', () => {
      const context = createContext({
        role: JobRole.QA,
        taskRole: TaskRole.REVIEWER,
        traits: {
          currentState: WorkflowState.TESTING,
          statesSetByEmployee: [WorkflowState.TESTING],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_IN_PROGRESS);
    });

    it('closing the task wins over taking it to testing', () => {
      const context = createContext({
        role: JobRole.QA,
        taskRole: TaskRole.OBSERVER,
        traits: {
          currentState: WorkflowState.TESTING,
          statesSetByEmployee: [WorkflowState.TESTING],
        },
        activity: {
          issueActions: [SourceEventAction.CLOSED],
          issueClosedOnReportDate: true,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.VERIFIED_FIX);
    });

    it('for an assignee developer the task is being tested by QA', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { activeStates: [WorkflowState.TESTING] },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.TASK_IN_QA_TESTING);
    });
  });

  describe('returned from QA', () => {
    it('QA who set the flag returned the task to development', () => {
      const context = createContext({
        role: JobRole.QA,
        taskRole: TaskRole.OBSERVER,
        traits: {
          flags: [TaskFlag.RETURNED_FROM_QA],
          flagsSetByEmployee: [TaskFlag.RETURNED_FROM_QA],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_RETURNED_TO_DEV);
    });

    it('the return to development wins over comments and the task state', () => {
      const context = createContext({
        role: JobRole.QA,
        taskRole: TaskRole.REVIEWER,
        kind: TaskKind.BUG,
        traits: {
          currentState: WorkflowState.TESTING,
          flags: [TaskFlag.RETURNED_FROM_QA],
          flagsSetByEmployee: [TaskFlag.RETURNED_FROM_QA],
        },
        activity: { mergeRequestCommentsFromEmployee: 5 },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_RETURNED_TO_DEV);
    });

    it('a developer pushing to a returned task fixes the remarks', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { flags: [TaskFlag.RETURNED_FROM_QA] },
        activity: pushed(['fix: validation error']),
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.DEV_FIXING_AFTER_QA);
    });

    it('an assignee developer without pushes is still fixing the remarks', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { flags: [TaskFlag.RETURNED_FROM_QA] },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.DEV_FIXING_AFTER_QA);
    });

    it('a developer who fixed the remarks sent the task back to testing', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: {
          flags: [TaskFlag.RETURNED_FROM_QA],
          currentState: WorkflowState.READY_FOR_QA,
          statesSetByEmployee: [WorkflowState.READY_FOR_QA],
        },
        activity: pushed(['fix: qa remarks']),
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.DEV_RESUBMITTED_TO_QA);
    });
  });

  describe('QA task', () => {
    it('QA with pushes develops autotests instead of manual testing', () => {
      const context = createContext({
        role: JobRole.QA,
        kind: TaskKind.QA_INTERNAL,
        traits: { kinds: [TaskKind.QA_INTERNAL] },
        activity: pushed(['feat: add account tests']),
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_AUTOMATION_DEVELOPED);
    });

    it('fixing failing tests in a maintenance task maintains autotests', () => {
      const context = createContext({
        role: JobRole.QA,
        kind: TaskKind.MAINTENANCE,
        traits: { kinds: [TaskKind.QA_INTERNAL, TaskKind.MAINTENANCE] },
        activity: pushed(['fix: flaky tests']),
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_AUTOMATION_MAINTAINED);
    });

    it('work without code on a maintenance task sets up the environment', () => {
      const context = createContext({
        role: JobRole.QA,
        kind: TaskKind.MAINTENANCE,
        traits: { kinds: [TaskKind.QA_INTERNAL, TaskKind.MAINTENANCE] },
        activity: { issueCommentsFromEmployee: 2 },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_TEST_ENVIRONMENT_SETUP);
    });

    it('without other signals it stays an internal QA task', () => {
      const context = createContext({
        role: JobRole.QA,
        kind: TaskKind.QA_INTERNAL,
        traits: { kinds: [TaskKind.QA_INTERNAL] },
        activity: { issueCommentsFromEmployee: 1 },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_INTERNAL_TASK);
    });

    it('a developer pushing to an internal QA task writes autotests too', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        kind: TaskKind.QA_INTERNAL,
        traits: { kinds: [TaskKind.QA_INTERNAL] },
        activity: pushed(['chore: page objects']),
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_AUTOMATION_DEVELOPED);
    });

    it('merging an own QA task does not become a product feature', () => {
      const context = createContext({
        role: JobRole.QA,
        kind: TaskKind.QA_INTERNAL,
        isMergeRequestAuthor: true,
        traits: { kinds: [TaskKind.QA_INTERNAL] },
        activity: {
          mergeRequestActions: [SourceEventAction.PUSHED_TO, SourceEventAction.ACCEPTED],
          mergeRequestCommitCount: 3,
          commitTitles: ['test: ssl admin cases'],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_AUTOMATION_DEVELOPED);
    });

    it('merging a QA task counts without a push on the report day', () => {
      const context = createContext({
        role: JobRole.QA,
        kind: TaskKind.QA_INTERNAL,
        isMergeRequestAuthor: true,
        traits: { kinds: [TaskKind.QA_INTERNAL] },
        activity: { mergeRequestActions: [SourceEventAction.ACCEPTED] },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_AUTOMATION_DEVELOPED);
    });
  });

  describe('e2e tests required', () => {
    it('QA pushing to the task develops e2e coverage', () => {
      const context = createContext({
        role: JobRole.QA,
        traits: { flags: [TaskFlag.E2E_REQUIRED] },
        activity: pushed(['add checkout flow']),
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_E2E_COVERAGE_ADDED);
    });

    it('a developer with test commits develops e2e coverage', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { flags: [TaskFlag.E2E_REQUIRED] },
        activity: pushed(['test: e2e for bucket page']),
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_E2E_COVERAGE_ADDED);
    });

    it('a developer without test commits keeps writing product code', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { flags: [TaskFlag.E2E_REQUIRED] },
        activity: {
          ...pushed(['feat: bucket endpoint']),
          mergeRequestState: null,
        },
      });

      expect(resolver.resolve(context)).not.toBe(ActivityAction.QA_E2E_COVERAGE_ADDED);
    });

    it('QA merging an own e2e merge request counts without a push on the day', () => {
      const context = createContext({
        role: JobRole.QA,
        kind: TaskKind.FEATURE,
        isMergeRequestAuthor: true,
        traits: { flags: [TaskFlag.E2E_REQUIRED] },
        activity: { mergeRequestActions: [SourceEventAction.ACCEPTED] },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_E2E_COVERAGE_ADDED);
    });

    it('merging e2e coverage stays work on tests', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        kind: TaskKind.FEATURE,
        isMergeRequestAuthor: true,
        traits: { flags: [TaskFlag.E2E_REQUIRED] },
        activity: {
          mergeRequestActions: [SourceEventAction.PUSHED_TO, SourceEventAction.ACCEPTED],
          mergeRequestCommitCount: 2,
          commitTitles: ['test: add e2e specs'],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_E2E_COVERAGE_ADDED);
    });
  });

  describe('project manager and system analyst', () => {
    it.each([JobRole.PROJECT_MANAGER, JobRole.SYSTEM_ANALYST])(
      '%s sent the task to testing',
      (role) => {
        const context = createContext({
          role,
          taskRole: TaskRole.AUTHOR,
          traits: {
            currentState: WorkflowState.READY_FOR_QA,
            statesSetByEmployee: [WorkflowState.READY_FOR_QA],
          },
        });

        expect(resolver.resolve(context)).toBe(ActivityAction.TASK_SENT_TO_QA);
      },
    );

    it.each([JobRole.PROJECT_MANAGER, JobRole.SYSTEM_ANALYST])(
      '%s: the task came back from testing',
      (role) => {
        const context = createContext({
          role,
          taskRole: TaskRole.AUTHOR,
          traits: { flags: [TaskFlag.RETURNED_FROM_QA] },
          activity: { issueCommentsFromEmployee: 1 },
        });

        expect(resolver.resolve(context)).toBe(ActivityAction.TASK_RETURNED_FROM_QA);
      },
    );

    it.each([JobRole.PROJECT_MANAGER, JobRole.SYSTEM_ANALYST])(
      '%s: the task is being tested',
      (role) => {
        const context = createContext({
          role,
          taskRole: TaskRole.AUTHOR,
          traits: { activeStates: [WorkflowState.TESTING] },
          activity: { issueCommentsFromEmployee: 1 },
        });

        expect(resolver.resolve(context)).toBe(ActivityAction.TASK_IN_QA_TESTING);
      },
    );

    it('closing the task wins over the QA context', () => {
      const context = createContext({
        role: JobRole.PROJECT_MANAGER,
        taskRole: TaskRole.AUTHOR,
        kind: TaskKind.FEATURE,
        traits: { flags: [TaskFlag.RETURNED_FROM_QA] },
        activity: {
          issueActions: [SourceEventAction.CLOSED],
          issueClosedOnReportDate: true,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.REVIEWED_AND_CLOSED);
    });
  });

  describe('QA passed', () => {
    it('QA who confirmed that testing passed', () => {
      const context = createContext({
        role: JobRole.QA,
        taskRole: TaskRole.OBSERVER,
        traits: {
          currentState: WorkflowState.QA_PASSED,
          statesSetByEmployee: [WorkflowState.QA_PASSED],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.TESTED_AND_APPROVED);
    });

    it('a developer gets passed testing', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { activeStates: [WorkflowState.QA_PASSED] },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.DEV_PASSED_QA);
    });

    it('for a project manager the task stays in the QA flow', () => {
      const context = createContext({
        role: JobRole.PROJECT_MANAGER,
        taskRole: TaskRole.AUTHOR,
        traits: { activeStates: [WorkflowState.QA_PASSED] },
        activity: { issueCommentsFromEmployee: 1 },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.TASK_IN_QA_TESTING);
    });
  });

  describe('on hold', () => {
    it.each([JobRole.DEVELOPER, JobRole.QA, JobRole.PROJECT_MANAGER])(
      '%s: a task put on hold gives PUT_ON_HOLD',
      (role) => {
        const context = createContext({
          role,
          traits: {
            currentState: WorkflowState.BLOCKED,
            statesSetByEmployee: [WorkflowState.BLOCKED],
          },
          activity: pushed(['wip']),
        });

        expect(resolver.resolve(context)).toBe(ActivityAction.PUT_ON_HOLD);
      },
    );

    it('closing the task wins over putting it on hold', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: {
          currentState: WorkflowState.BLOCKED,
          statesSetByEmployee: [WorkflowState.BLOCKED],
        },
        activity: {
          issueState: ItemState.CLOSED,
          issueActions: [SourceEventAction.CLOSED],
          issueClosedOnReportDate: true,
        },
      });

      expect(resolver.resolve(context)).not.toBe(ActivityAction.PUT_ON_HOLD);
    });
  });

  describe('sprint planning', () => {
    it('a project manager who planned the task takes it into the sprint', () => {
      const context = createContext({
        role: JobRole.PROJECT_MANAGER,
        taskRole: TaskRole.AUTHOR,
        traits: {
          currentState: WorkflowState.PLANNED,
          statesSetByEmployee: [WorkflowState.PLANNED],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.PLANNED_FOR_SPRINT);
    });
  });

  describe('needs rebase and unit tests', () => {
    it('a removed needs-rebase with a push resolves conflicts', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { needsRebaseResolved: true },
        activity: pushed(['merge branch main']),
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.RESOLVED_MERGE_CONFLICTS);
    });

    it('a removed needs-rebase without a push gives nothing', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { needsRebaseResolved: true },
        activity: { issueCommentsFromEmployee: 1 },
      });

      expect(resolver.resolve(context)).not.toBe(ActivityAction.RESOLVED_MERGE_CONFLICTS);
    });

    it('commits with unit tests in a task that needs them', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { flags: [TaskFlag.UNIT_TESTS_REQUIRED] },
        activity: pushed(['test: cover service with unit specs']),
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.WROTE_TESTS);
    });
  });

  describe('closing is an event of the day, not a state', () => {
    it('QA commenting on a long closed task does not verify a fix', () => {
      const context = createContext({
        role: JobRole.QA,
        taskRole: TaskRole.OBSERVER,
        activity: {
          issueState: ItemState.CLOSED,
          issueClosedOnReportDate: false,
          issueCommentsFromEmployee: 1,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.COMMENTED);
    });

    it('closing on the report day counts for QA as verification', () => {
      const context = createContext({
        role: JobRole.QA,
        taskRole: TaskRole.OBSERVER,
        activity: {
          issueState: ItemState.CLOSED,
          issueClosedOnReportDate: true,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.VERIFIED_FIX);
    });

    it('a project manager commenting on a long closed task does not accept work', () => {
      const context = createContext({
        role: JobRole.PROJECT_MANAGER,
        taskRole: TaskRole.AUTHOR,
        activity: {
          issueState: ItemState.CLOSED,
          issueClosedOnReportDate: false,
          issueCommentsFromEmployee: 1,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.COMMENTED);
    });

    it('an assignee developer does not complete a task by merge after the fact', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        activity: {
          ...pushed(['feat: next step']),
          issueState: ItemState.CLOSED,
          mergeRequestState: ItemState.MERGED,
          issueClosedOnReportDate: false,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.WROTE_CODE);
    });
  });

  describe('the task context does not replace the own actions of a project manager', () => {
    it('an own return to development wins', () => {
      const context = createContext({
        role: JobRole.PROJECT_MANAGER,
        taskRole: TaskRole.AUTHOR,
        traits: {
          flags: [TaskFlag.RETURNED_FROM_QA],
          flagsSetByEmployee: [TaskFlag.RETURNED_FROM_QA],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.TASK_RETURNED_FROM_QA);
    });

    it('providing requirements wins over the task waiting in QA', () => {
      const context = createContext({
        role: JobRole.PROJECT_MANAGER,
        taskRole: TaskRole.AUTHOR,
        traits: {
          currentState: WorkflowState.NEEDS_INFO,
          activeStates: [WorkflowState.TESTING],
        },
        activity: { issueCommentsFromEmployee: 2 },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.PROVIDED_REQUIREMENTS);
    });
  });

  describe('QA passed for a developer', () => {
    it('QA passed today is a visible result of the day for a developer', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { currentState: WorkflowState.QA_PASSED },
        activity: pushed(['feat: unrelated']),
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.DEV_PASSED_QA);
    });

    it('an old QA passed does not override work on code', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { activeStates: [WorkflowState.QA_PASSED] },
        activity: {
          ...pushed(['feat: unrelated']),
          mergeRequestState: ItemState.OPENED,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.WROTE_CODE);
    });

    it('without active work an old QA passed becomes the result', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { activeStates: [WorkflowState.QA_PASSED] },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.DEV_PASSED_QA);
    });
  });

  describe('review threads', () => {
    it('open threads mean the remarks are being fixed', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        activity: {
          ...pushed(['fix: review notes']),
          mergeRequestState: ItemState.OPENED,
          reviewThreadCount: 3,
          unresolvedReviewThreadCount: 2,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.RESOLVING_REVIEW_COMMENTS);
    });

    it('all threads resolved means the remarks are fixed', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        activity: {
          ...pushed(['fix: review notes']),
          mergeRequestState: ItemState.OPENED,
          reviewThreadCount: 3,
          unresolvedReviewThreadCount: 0,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.RESOLVED_REVIEW_COMMENTS);
    });

    it('without threads and dialog the rule does not apply', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        activity: {
          ...pushed(['feat: new code']),
          mergeRequestState: ItemState.OPENED,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.WROTE_CODE);
    });

    it('a dialog outside review is a discussion, not work on remarks', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        activity: {
          ...pushed(['feat: new code']),
          mergeRequestState: ItemState.OPENED,
          mergeRequestCommentsFromEmployee: 1,
          mergeRequestCommentsFromOthers: 1,
        },
      });

      expect(resolver.resolve(context)).not.toBe(ActivityAction.RESOLVING_REVIEW_COMMENTS);
      expect(resolver.resolve(context)).toBe(ActivityAction.WROTE_CODE);
    });

    it('the same dialog during review is work on remarks', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        traits: { activeStates: [WorkflowState.REVIEW] },
        activity: {
          ...pushed(['feat: new code']),
          mergeRequestState: ItemState.OPENED,
          mergeRequestCommentsFromEmployee: 1,
          mergeRequestCommentsFromOthers: 1,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.RESOLVING_REVIEW_COMMENTS);
    });

    it('threads win over the state: remarks are fixed even outside review', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        activity: {
          ...pushed(['fix: notes']),
          mergeRequestState: ItemState.OPENED,
          reviewThreadCount: 2,
          unresolvedReviewThreadCount: 0,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.RESOLVED_REVIEW_COMMENTS);
    });

    it('a QA reviewer of a task in review tests it', () => {
      const context = createContext({
        role: JobRole.QA,
        taskRole: TaskRole.REVIEWER,
        traits: { activeStates: [WorkflowState.REVIEW] },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.QA_IN_PROGRESS);
    });

    it('a developer reviewer of the same task does a code review', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        taskRole: TaskRole.REVIEWER,
        traits: { activeStates: [WorkflowState.REVIEW] },
        activity: { mergeRequestState: ItemState.OPENED },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.STARTED_REVIEW);
    });
  });

  describe('creating a task', () => {
    it('creating a work item gives a created task', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        taskRole: TaskRole.AUTHOR,
        activity: { issueActions: [SourceEventAction.CREATED] },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.CREATED);
    });

    it('QA who created a bug as a work item found a bug', () => {
      const context = createContext({
        role: JobRole.QA,
        taskRole: TaskRole.OBSERVER,
        kind: TaskKind.BUG,
        activity: { issueActions: [SourceEventAction.CREATED] },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.FOUND_BUG);
    });
  });

  describe('hotfixes', () => {
    it('an urgent merge of a merge request without a task is a hotfix', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        isMergeRequestAuthor: true,
        traits: { priority: Priority.CRITICAL },
        activity: {
          mergeRequestState: ItemState.MERGED,
          mergeRequestActions: [SourceEventAction.ACCEPTED],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.HOTFIX_DEPLOYED);
    });

    it('a bug kind does not turn a hotfix into something else', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        kind: TaskKind.BUG,
        isMergeRequestAuthor: true,
        traits: {
          priority: Priority.CRITICAL,
          kinds: [TaskKind.BUG],
        },
        activity: {
          mergeRequestState: ItemState.MERGED,
          mergeRequestActions: [SourceEventAction.ACCEPTED],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.HOTFIX_DEPLOYED);
    });

    it('the hotfix kind gives a hotfix for a task with a merge request too', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        kind: TaskKind.HOTFIX,
        isMergeRequestAuthor: true,
        traits: { kinds: [TaskKind.HOTFIX] },
        activity: {
          issueState: ItemState.OPENED,
          mergeRequestState: ItemState.MERGED,
          mergeRequestActions: [SourceEventAction.ACCEPTED],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.HOTFIX_DEPLOYED);
    });

    it('a critical bug with a task is a bug fix, not a deploy', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        kind: TaskKind.BUG,
        isMergeRequestAuthor: true,
        traits: { priority: Priority.CRITICAL },
        activity: {
          issueState: ItemState.OPENED,
          mergeRequestState: ItemState.MERGED,
          mergeRequestActions: [SourceEventAction.ACCEPTED],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.FIXED_BUG);
    });
  });

  describe('one task, reviewers with different roles', () => {
    const asReviewer = (role: JobRole, extra = {}) =>
      createContext({
        role,
        taskRole: TaskRole.REVIEWER,
        traits: { activeStates: [WorkflowState.REVIEW] },
        activity: {
          mergeRequestState: ItemState.OPENED,
          ...extra,
        },
      });

    it('without actions: a developer reviews, QA tests', () => {
      expect(resolver.resolve(asReviewer(JobRole.DEVELOPER))).toBe(ActivityAction.STARTED_REVIEW);
      expect(resolver.resolve(asReviewer(JobRole.QA))).toBe(ActivityAction.QA_IN_PROGRESS);
    });

    it('after approval: a developer approved, QA confirmed', () => {
      const approved = { employeeApproved: true };
      expect(
        resolver.resolve(
          createContext({
            role: JobRole.DEVELOPER,
            taskRole: TaskRole.REVIEWER,
            traits: { activeStates: [WorkflowState.REVIEW] },
            approvals: approved,
          }),
        ),
      ).toBe(ActivityAction.APPROVED_MR);

      expect(
        resolver.resolve(
          createContext({
            role: JobRole.QA,
            taskRole: TaskRole.REVIEWER,
            traits: { activeStates: [WorkflowState.REVIEW] },
            approvals: approved,
          }),
        ),
      ).toBe(ActivityAction.TESTED_AND_APPROVED);
    });

    it('remarks without approval: a developer requested changes, QA tested with remarks', () => {
      const manyComments = { mergeRequestCommentsFromEmployee: 5 };
      expect(resolver.resolve(asReviewer(JobRole.DEVELOPER, manyComments))).toBe(
        ActivityAction.REQUESTED_CHANGES,
      );
      expect(resolver.resolve(asReviewer(JobRole.QA, manyComments))).toBe(
        ActivityAction.TESTED_WITH_COMMENTS,
      );
    });
  });

  describe('existing rules', () => {
    it('a usual merge of an own feature is not affected', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        kind: TaskKind.FEATURE,
        isMergeRequestAuthor: true,
        activity: { mergeRequestActions: [SourceEventAction.ACCEPTED] },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.IMPLEMENTED_FEATURE);
    });

    it('QA who escalated a critical bug in testing blocks the release', () => {
      const context = createContext({
        role: JobRole.QA,
        taskRole: TaskRole.OBSERVER,
        kind: TaskKind.BUG,
        traits: {
          currentState: WorkflowState.TESTING,
          priority: Priority.CRITICAL,
          priorityEscalatedByEmployee: true,
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.BLOCKED_RELEASE);
    });

    it('a return from QA testing to in progress is a return for revision', () => {
      const context = createContext({
        role: JobRole.DEVELOPER,
        taskRole: TaskRole.REVIEWER,
        traits: {
          currentState: WorkflowState.IN_PROGRESS,
          previousState: WorkflowState.TESTING,
          statesSetByEmployee: [WorkflowState.IN_PROGRESS],
        },
      });

      expect(resolver.resolve(context)).toBe(ActivityAction.RETURNED_FOR_REVISION);
    });
  });
});
