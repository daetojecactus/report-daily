export enum LabelDimension {
  WORKFLOW_STATE = 'workflow_state',
  TASK_KIND = 'task_kind',
  PRIORITY = 'priority',
  SEVERITY = 'severity',
  AREA = 'area',
  FLAG = 'flag',
}

export enum WorkflowState {
  BACKLOG = 'backlog',
  PLANNED = 'planned',
  ANALYSIS = 'analysis',
  DESIGN = 'design',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  CHANGES_REQUESTED = 'changes_requested',
  READY_FOR_QA = 'ready_for_qa',
  TESTING = 'testing',
  QA_PASSED = 'qa_passed',
  READY_FOR_RELEASE = 'ready_for_release',
  STAGING = 'staging',
  RELEASED = 'released',
  DONE = 'done',
  CANCELLED = 'cancelled',
  BLOCKED = 'blocked',
  NEEDS_INFO = 'needs_info',
  HANDOFF = 'handoff',
}

export enum TaskKind {
  HOTFIX = 'hotfix',
  INCIDENT = 'incident',
  BUG = 'bug',
  FEATURE = 'feature',
  IMPROVEMENT = 'improvement',
  MAINTENANCE = 'maintenance',
  DEPENDENCY = 'dependency',
  EPIC = 'epic',
  QA_INTERNAL = 'qa_internal',
  TEST_AUTOMATION = 'test_automation',
  DOCUMENTATION = 'documentation',
  REQUIREMENTS = 'requirements',
  RESEARCH = 'research',
  SUPPORT = 'support',
  RELEASE = 'release',
  TASK = 'task',
}

export enum Priority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum Severity {
  BLOCKER = 'blocker',
  CRITICAL = 'critical',
  MAJOR = 'major',
  MINOR = 'minor',
}

export enum TaskArea {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  MOBILE = 'mobile',
  API = 'api',
  DATABASE = 'database',
  DATA = 'data',
  INFRASTRUCTURE = 'infrastructure',
  CI_CD = 'ci_cd',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  ACCESSIBILITY = 'accessibility',
  DESIGN = 'design',
}

export enum TaskFlag {
  EXCLUDE_FROM_REPORT = 'exclude_from_report',
  RETURNED_FROM_QA = 'returned_from_qa',
  E2E_REQUIRED = 'e2e_required',
  UNIT_TESTS_REQUIRED = 'unit_tests_required',
  NEEDS_REBASE = 'needs_rebase',
  REGRESSION = 'regression',
  FLAKY_TEST = 'flaky_test',
  DRAFT = 'draft',
  BREAKING_CHANGE = 'breaking_change',
  CUSTOMER_REQUEST = 'customer_request',
}
