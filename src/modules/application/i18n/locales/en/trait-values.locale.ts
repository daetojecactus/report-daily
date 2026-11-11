import {
  TraitDimension,
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/types/trait.enums';
import type { TraitsLocale } from '../../types/i18n-traits.interface';

export const enTraitValues: TraitsLocale['traits'] = {
  dimensions: {
    [TraitDimension.WORKFLOW_STATE]: 'State',
    [TraitDimension.TASK_KIND]: 'Task type',
    [TraitDimension.PRIORITY]: 'Priority',
    [TraitDimension.SEVERITY]: 'Severity',
    [TraitDimension.AREA]: 'Area',
    [TraitDimension.FLAG]: 'Flag',
  },
  values: {
    [TraitDimension.WORKFLOW_STATE]: {
      [WorkflowState.BACKLOG]: {
        name: 'Backlog',
        description: 'Created but not planned yet',
      },
      [WorkflowState.PLANNED]: {
        name: 'Planned',
        description: 'Planned and waiting to start',
      },
      [WorkflowState.ANALYSIS]: {
        name: 'Analysis',
        description: 'Requirements, refinement, breakdown',
      },
      [WorkflowState.DESIGN]: {
        name: 'Design',
        description: 'Mockups, UX, solution validation',
      },
      [WorkflowState.IN_PROGRESS]: {
        name: 'In progress',
        description: 'Being developed',
      },
      [WorkflowState.REVIEW]: {
        name: 'In review',
        description: 'Waiting for or in code review',
      },
      [WorkflowState.CHANGES_REQUESTED]: {
        name: 'Changes requested',
        description: 'The reviewer asked for changes',
      },
      [WorkflowState.READY_FOR_QA]: {
        name: 'Ready for QA',
        description: 'Development is done, waiting for QA',
      },
      [WorkflowState.TESTING]: {
        name: 'Testing',
        description: 'QA is testing it',
      },
      [WorkflowState.QA_PASSED]: {
        name: 'QA passed',
        description: 'QA confirmed it',
      },
      [WorkflowState.READY_FOR_RELEASE]: {
        name: 'Ready for release',
        description: 'Accepted, waiting for deployment',
      },
      [WorkflowState.STAGING]: {
        name: 'On staging',
        description: 'Deployed to a test stand or staging',
      },
      [WorkflowState.RELEASED]: {
        name: 'Released',
        description: 'In production, including behind a feature flag',
      },
      [WorkflowState.DONE]: {
        name: 'Done',
        description: 'The work is finished',
      },
      [WorkflowState.CANCELLED]: {
        name: 'Cancelled',
        description: 'Will not be done: a duplicate, obsolete or not reproducible',
      },
      [WorkflowState.BLOCKED]: {
        name: 'Blocked',
        description: 'On hold or waiting for something external',
      },
      [WorkflowState.NEEDS_INFO]: {
        name: 'Needs info',
        description: 'Waiting for clarification',
      },
      [WorkflowState.HANDOFF]: {
        name: 'Handed off',
        description: 'Passed to another part of the team',
      },
    },
    [TraitDimension.TASK_KIND]: {
      [TaskKind.HOTFIX]: {
        name: 'Hotfix',
        description: 'An urgent fix in production',
      },
      [TaskKind.INCIDENT]: {
        name: 'Incident',
        description: 'A system failure',
      },
      [TaskKind.BUG]: { name: 'Bug', description: 'Something works wrong' },
      [TaskKind.FEATURE]: {
        name: 'Feature',
        description: 'A new capability',
      },
      [TaskKind.IMPROVEMENT]: {
        name: 'Improvement',
        description: 'Making something existing better',
      },
      [TaskKind.MAINTENANCE]: {
        name: 'Tech debt',
        description: 'Refactoring, cleanup, maintenance',
      },
      [TaskKind.DEPENDENCY]: {
        name: 'Dependencies',
        description: 'Library and dependency updates',
      },
      [TaskKind.EPIC]: {
        name: 'Epic',
        description: 'A large task with subtasks',
      },
      [TaskKind.QA_INTERNAL]: {
        name: 'QA task',
        description: 'Test plans, test data, QA tools',
      },
      [TaskKind.TEST_AUTOMATION]: {
        name: 'Test automation',
        description: 'Writing and fixing automated tests',
      },
      [TaskKind.DOCUMENTATION]: {
        name: 'Documentation',
        description: 'Docs, help, README',
      },
      [TaskKind.REQUIREMENTS]: {
        name: 'Requirements',
        description: 'Specifications and requirements',
      },
      [TaskKind.RESEARCH]: {
        name: 'Research',
        description: 'A spike, prototype or comparison',
      },
      [TaskKind.SUPPORT]: {
        name: 'Support',
        description: 'A user question or request',
      },
      [TaskKind.RELEASE]: {
        name: 'Release',
        description: 'Preparing and running a release',
      },
      [TaskKind.TASK]: {
        name: 'Task',
        description: 'A plain task without a special type',
      },
    },
    [TraitDimension.PRIORITY]: {
      [Priority.CRITICAL]: {
        name: 'Critical',
        description: 'Needed right now',
      },
      [Priority.HIGH]: { name: 'High', description: 'Needed soon' },
      [Priority.MEDIUM]: { name: 'Medium', description: 'As planned' },
      [Priority.LOW]: { name: 'Low', description: 'When there is time' },
    },
    [TraitDimension.SEVERITY]: {
      [Severity.BLOCKER]: {
        name: 'S1 — blocker',
        description: 'Work is impossible, no workaround',
      },
      [Severity.CRITICAL]: {
        name: 'S2 — critical',
        description: 'An important function does not work',
      },
      [Severity.MAJOR]: {
        name: 'S3 — major',
        description: 'Works with errors, there is a workaround',
      },
      [Severity.MINOR]: {
        name: 'S4 — minor',
        description: 'Cosmetic issues and small things',
      },
    },
    [TraitDimension.AREA]: {
      [TaskArea.FRONTEND]: {
        name: 'Frontend',
        description: 'The web interface',
      },
      [TaskArea.BACKEND]: { name: 'Backend', description: 'Server logic' },
      [TaskArea.MOBILE]: {
        name: 'Mobile app',
        description: 'iOS and Android',
      },
      [TaskArea.API]: {
        name: 'API',
        description: 'External and internal APIs, integrations',
      },
      [TaskArea.DATABASE]: {
        name: 'Database',
        description: 'Schema, migrations, queries, indexes',
      },
      [TaskArea.DATA]: {
        name: 'Data and analytics',
        description: 'DWH, ETL, BI, reports, dashboards',
      },
      [TaskArea.INFRASTRUCTURE]: {
        name: 'Infrastructure',
        description: 'Servers, cloud, networks, Kubernetes, monitoring',
      },
      [TaskArea.CI_CD]: {
        name: 'CI/CD',
        description: 'Builds, pipelines, deployment',
      },
      [TaskArea.SECURITY]: {
        name: 'Security',
        description: 'Vulnerabilities, access, certificates',
      },
      [TaskArea.PERFORMANCE]: {
        name: 'Performance',
        description: 'Speed, load, scaling',
      },
      [TaskArea.ACCESSIBILITY]: {
        name: 'Accessibility',
        description: 'Usability for people with disabilities',
      },
      [TaskArea.DESIGN]: {
        name: 'Design and UX',
        description: 'Mockups and usability',
      },
    },
    [TraitDimension.FLAG]: {
      [TaskFlag.EXCLUDE_FROM_REPORT]: {
        name: 'Not in report',
        description: 'The task stays out of the report',
      },
      [TaskFlag.RETURNED_FROM_QA]: {
        name: 'Returned from QA',
        description: 'QA sent the task back for changes',
      },
      [TaskFlag.E2E_REQUIRED]: {
        name: 'E2E tests needed',
        description: 'The task needs end-to-end tests',
      },
      [TaskFlag.UNIT_TESTS_REQUIRED]: {
        name: 'Unit tests needed',
        description: 'The task needs unit tests',
      },
      [TaskFlag.NEEDS_REBASE]: {
        name: 'Needs rebase',
        description: 'The branch is behind the target branch',
      },
      [TaskFlag.REGRESSION]: {
        name: 'Regression',
        description: 'Something that worked is broken',
      },
      [TaskFlag.FLAKY_TEST]: {
        name: 'Flaky test',
        description: 'The test passes and fails at random',
      },
      [TaskFlag.DRAFT]: {
        name: 'Draft',
        description: 'The MR is not ready to merge',
      },
      [TaskFlag.BREAKING_CHANGE]: {
        name: 'Breaking change',
        description: 'An incompatible change',
      },
      [TaskFlag.CUSTOMER_REQUEST]: {
        name: 'Customer request',
        description: 'Requested by a customer',
      },
    },
  },
};
