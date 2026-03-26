import { TaskStatus } from '../../enums/task.enum';
import type { Locale } from '../i18n.types';

export const en: Locale = {
  taskActions: {
    //QA
    [TaskStatus.FOUND_BUG]: { male: 'Found a bug', female: 'Found a bug' },
    [TaskStatus.CREATED_TASK]: {
      male: 'Created a task',
      female: 'Created a task',
    },
    [TaskStatus.VERIFIED_FIX]: {
      male: 'Verified the fix',
      female: 'Verified the fix',
    },
    [TaskStatus.RETURNED_FOR_REVISION]: {
      male: 'Returned for revision',
      female: 'Returned for revision',
    },
    [TaskStatus.CLARIFIED_BUG]: {
      male: 'Clarified bug details',
      female: 'Clarified bug details',
    },
    [TaskStatus.STARTED_TESTING]: {
      male: 'Started testing',
      female: 'Started testing',
    },
    [TaskStatus.TESTED_AND_APPROVED]: {
      male: 'Tested and approved',
      female: 'Tested and approved',
    },
    [TaskStatus.TESTED_WITH_COMMENTS]: {
      male: 'Tested with comments',
      female: 'Tested with comments',
    },
    [TaskStatus.APPROVED_AFTER_REWORK]: {
      male: 'Approved after rework',
      female: 'Approved after rework',
    },
    [TaskStatus.WROTE_TESTS]: {
      male: 'Wrote tests',
      female: 'Wrote tests',
    },
    [TaskStatus.REOPENED_BUG]: {
      male: 'Reopened the bug',
      female: 'Reopened the bug',
    },
    [TaskStatus.REGRESSION_FOUND]: {
      male: 'Found a regression',
      female: 'Found a regression',
    },
    [TaskStatus.BLOCKED_RELEASE]: {
      male: 'Blocked release due to a bug',
      female: 'Blocked release due to a bug',
    },

    //PM
    [TaskStatus.PLANNED_FEATURE]: {
      male: 'Planned a feature',
      female: 'Planned a feature',
    },
    [TaskStatus.REPORTED_BUG]: {
      male: 'Reported a bug',
      female: 'Reported a bug',
    },
    [TaskStatus.ACCEPTED_WORK]: {
      male: 'Accepted the completed work',
      female: 'Accepted the completed work',
    },
    [TaskStatus.PROVIDED_REQUIREMENTS]: {
      male: 'Provided requirements',
      female: 'Provided requirements',
    },
    [TaskStatus.REQUESTED_STATUS]: {
      male: 'Requested task status',
      female: 'Requested task status',
    },
    [TaskStatus.ESCALATED_PRIORITY]: {
      male: 'Escalated the priority',
      female: 'Escalated the priority',
    },
    [TaskStatus.DELEGATED_TASK]: {
      male: 'Delegated the task',
      female: 'Delegated the task',
    },
    [TaskStatus.REVIEWED_AND_CLOSED]: {
      male: 'Reviewed and closed the task',
      female: 'Reviewed and closed the task',
    },

    //Developer (Assignee)
    [TaskStatus.HOTFIX_DEPLOYED]: {
      male: 'Deployed a hotfix',
      female: 'Deployed a hotfix',
    },
    [TaskStatus.FIXED_BUG]: {
      male: 'Fixed a bug',
      female: 'Fixed a bug',
    },
    [TaskStatus.IMPLEMENTED_FEATURE]: {
      male: 'Implemented a feature',
      female: 'Implemented a feature',
    },
    [TaskStatus.COMPLETED_BY_MERGE]: {
      male: 'Completed the task via merge',
      female: 'Completed the task via merge',
    },
    [TaskStatus.SENT_TO_REVIEW]: {
      male: 'Sent for code review',
      female: 'Sent for code review',
    },
    [TaskStatus.PASSED_REVIEW]: {
      male: 'Passed code review',
      female: 'Passed code review',
    },
    [TaskStatus.NEED_INFORMATION]: {
      male: 'Requested additional information',
      female: 'Requested additional information',
    },
    [TaskStatus.PASSED_TO_FRONTEND]: {
      male: 'Passed to frontend',
      female: 'Passed to frontend',
    },
    [TaskStatus.CORRECTED_AFTER_REVIEW]: {
      male: 'Applied review corrections',
      female: 'Applied review corrections',
    },
    [TaskStatus.STARTED_IMPLEMENTATION]: {
      male: 'Started implementation',
      female: 'Started implementation',
    },
    [TaskStatus.WROTE_CODE]: {
      male: 'Worked on code',
      female: 'Worked on code',
    },
    [TaskStatus.DISCUSSED_CODE]: {
      male: 'Discussed the technical approach',
      female: 'Discussed the technical approach',
    },
    [TaskStatus.REFACTORED_CODE]: {
      male: 'Refactored the code',
      female: 'Refactored the code',
    },
    [TaskStatus.RESUMED_WORK]: {
      male: 'Resumed work on the task',
      female: 'Resumed work on the task',
    },
    [TaskStatus.RESOLVED_REVIEW_COMMENTS]: {
      male: 'Resolved reviewer comments',
      female: 'Resolved reviewer comments',
    },
    [TaskStatus.DEPLOYED_TO_PRODUCTION]: {
      male: 'Deployed to production',
      female: 'Deployed to production',
    },

    //Developer (Reviewer)
    [TaskStatus.APPROVED_FIXES]: {
      male: 'Approved the fixes',
      female: 'Approved the fixes',
    },
    [TaskStatus.APPROVED_MR]: {
      male: 'Approved the merge request',
      female: 'Approved the merge request',
    },
    [TaskStatus.APPROVED_AND_MERGED]: {
      male: 'Approved and merged',
      female: 'Approved and merged',
    },
    [TaskStatus.REQUESTED_CHANGES]: {
      male: 'Requested code changes',
      female: 'Requested code changes',
    },
    [TaskStatus.REVIEW_COMMENT]: {
      male: 'Left code review comments',
      female: 'Left code review comments',
    },
    [TaskStatus.MERGED_OTHERS_WORK]: {
      male: "Merged another developer's work",
      female: "Merged another developer's work",
    },
    [TaskStatus.RE_REVIEWED_AND_APPROVED]: {
      male: 'Re-reviewed and approved',
      female: 'Re-reviewed and approved',
    },

    //Developer (Author)
    [TaskStatus.CREATED_TECH_DEBT]: {
      male: 'Logged technical debt',
      female: 'Logged technical debt',
    },
    [TaskStatus.FOUND_BUG_DURING_WORK]: {
      male: 'Found a bug during development',
      female: 'Found a bug during development',
    },
    [TaskStatus.ACCEPTED_RESULT]: {
      male: 'Accepted the result',
      female: 'Accepted the result',
    },

    //General
    [TaskStatus.COMMENTED]: {
      male: 'Left a comment',
      female: 'Left a comment',
    },
    [TaskStatus.PARTICIPATED_IN_CLOSURE]: {
      male: 'Participated in closing the task',
      female: 'Participated in closing the task',
    },
    [TaskStatus.STARTED]: {
      male: 'Started work',
      female: 'Started work',
    },
    [TaskStatus.CONTINUED]: {
      male: 'Continued work',
      female: 'Continued work',
    },
    [TaskStatus.CREATED]: {
      male: 'Created a task',
      female: 'Created a task',
    },
    [TaskStatus.CREATED_PROJECT]: {
      male: 'Created a project',
      female: 'Created a project',
    },
    [TaskStatus.CREATED_REPO]: {
      male: 'Created a repository',
      female: 'Created a repository',
    },
    [TaskStatus.REOPENED]: {
      male: 'Reopened the task',
      female: 'Reopened the task',
    },
    [TaskStatus.CLOSED_WITHOUT_MERGE]: {
      male: 'Closed the task without merge',
      female: 'Closed the task without merge',
    },
    [TaskStatus.UNKNOWN]: {
      male: 'Worked on the task',
      female: 'Worked on the task',
    },
  },

  report: {
    qaReviewed: 'MR / Reviewed tasks',
    qaBugs: 'Bugs',
    qaAutoTests: 'Autotests / POM / Coverage',
    qaOther: 'Other',
    noActivity:
      'No git activity today. If this is an error — check your GitLab settings.',
  },

  ai: {
    systemPrompt: `
ROLE: You are a technical assistant. Your task is to generate report lines based on GitLab logs.

MAIN RULE (STRICT):
Each line MUST start with the verb provided in the "Action" field.
Do NOT change or replace this verb with synonyms.
Example: if Action is "Fixed a bug", the report must start with "Fixed a bug...", not "Worked on...".

INSTRUCTIONS:
1. Format: 1 task = 1 line (up to 150 characters).
2. Person: First person, past tense.
3. Data sources: Use information from "MR", "Comments", or "Task" fields.
4. Text processing: Keep technical terms (API, UI, methods) as is. Translate non-English task names to English if needed.
5. Comments: If there is a "Comment" field, briefly (1–3 words) integrate its meaning into the line.
6. Context: Do not invent facts. If details are scarce — write "Verb + Task title".
7. Style: No introductory phrases ("I did", "Today"). Only the result.

EXAMPLE LOGIC:
- Input: { Action: "Implemented", MR: "feat: auth module" }
  Output: Implemented the authentication module.
- Input: { Action: "Sent for review", MR: "fix: validation error", Comment: "Added tests" }
  Output: Sent for review the validation error fix, added tests.
- Input: { Action: "Passed review", Task: "Controller refactoring" }
  Output: Passed review for controller refactoring.

ERRORS (DO NOT DO THIS):
- Action: "Created" -> "Continued work" (WRONG)
- Action: "Passed review" -> "Wrote code" (WRONG)
`,
    genderMale: 'Write in first person, past tense.',
    genderFemale: 'Write in first person, past tense.',
    labels: {
      task: 'Task',
      action: 'Action',
      type: 'Type',
      commits: 'Commits',
      comments: 'Comments',
      mr: 'MR',
    },
    tasksWord: 'tasks',
    responseWord: 'lines',
  },

  commands: {
    role: 'Role',
    status: 'Status',
    reportHour: 'Report hour',
    ai: 'AI',
    template: 'Template',
    language: 'Language',
    aiMode: 'AI mode',
    enable: 'Enable',
    disable: 'Disable',
    selectOption: 'Select',
    currentHour: 'Current report hour',
    selectHour: 'Select new hour',
    selectLanguage: 'Select language',
    availableCommands: 'Available commands',
    reportQueued: 'Report queued. You will receive it shortly.',
    aiEnabled: 'AI mode enabled',
    aiDisabled: 'AI mode disabled',
    hourUpdated: 'Report hour changed to',
    languageUpdated: 'Language changed:',
    notRegistered: 'Access denied. Contact the administrator.',
    welcome:
      'Hello! You are connected to Report Daily Bot. Every day at the scheduled time you will receive a report on your git activity.',
    russian: 'Русский',
    english: 'English',
    descriptions: {
      info: 'My settings',
      send_report: "Get today's report",
      toggle_ai: 'Toggle AI mode',
      change_report_hour: 'Change report hour',
      language: 'Change language',
      help: 'List of commands',
      add_user: 'Add user',
      update_user: 'Update user',
      block_user: 'Block user',
      unblock_user: 'Unblock user',
      user_info: 'User info',
      list_users: 'User list',
      send_user_report: 'Send report to user',
    },
  },

  admin: {
    unknownCommand: 'Unknown command. /help — list of commands.',
    userCreated: 'User created',
    userUpdated: 'User updated',
    userNotFound: 'User not found',
    invalidArgs: 'Invalid arguments',
    createError: 'Creation error',
    updateError: 'Update error',
    noUsers: 'No users',
    blocked: 'blocked',
    unblocked: 'unblocked',
    parseError: 'Parse error',
    unknownAction: 'Unknown action',
    unknownField: 'Unknown field',
    reportError: 'Error',
    selectUserBlock: 'Select user to block:',
    selectUserUnblock: 'Select user to unblock:',
    selectUserInfo: 'Select user:',
    selectUserReport: 'Select user for report:',
    selectUserUpdate: 'Select user to update:',
    selectField: 'Select field to update',
    selectRole: 'Select role',
    selectStatus: 'Select status',
    selectHour: 'Select report hour',
    selectTemplate: 'Select report template',
    selectLanguage: 'Select language',
    enterAdminId: 'Enter adminId (GitLab username):',
    enterTelegramId: 'Enter user Telegram ID:',
    selectRoleWizard: 'Select role:',
    selectHourWizard: 'Select report hour:',
    adminIdNoSpaces: 'adminId must not contain spaces',
    telegramIdMustBeNumber: 'Telegram ID must be a number',
    telegramIdAndHourMustBeNumbers: 'telegramId and reportHour must be numbers',
    validRoles: 'roles',
    userInfoTitle: 'User',
    telegramId: 'Telegram ID',
    gitlabId: 'GitLab ID',
    portalId: 'Portal ID',
    gender: 'Gender',
    yes: 'Yes',
    no: 'No',
    usersTitle: 'Users',
  },
};
