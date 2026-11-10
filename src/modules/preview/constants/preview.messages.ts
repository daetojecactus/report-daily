export enum PreviewMessages {
  USAGE = 'Usage: pnpm preview <gitlab-username> <YYYY-MM-DD> [--trace] [--lang=ru|en] [--ai]',
  GOLDEN_USAGE = 'Usage: pnpm golden <directory> <YYYY-MM-DD>...',
  EMPLOYEE_NOT_FOUND = 'No employee with this GitLab username',
  FAILED = 'Preview failed',
  GOLDEN_FAILED = 'Recording golden fixtures failed',
  GOLDEN_WRITTEN = 'Golden fixtures written',
}
