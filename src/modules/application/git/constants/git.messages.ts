export const GitMessages = {
  PROJECT_NOT_FOUND: (id: number) => `Project_${id}`,
} as const;

export const GitPattern = {
  MERGE_BRANCH: /Merge branch '([^']+)'/,
  TASK_ID_FROM_BRANCH: /^(\d+)-/,
  TASK_ID_FROM_TITLE: /^#?(\d+)[-:\s]/,
} as const;
