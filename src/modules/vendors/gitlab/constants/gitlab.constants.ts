export const GITLAB_API_PATH = '/api/v4';

export const GITLAB_URL_TRAILING_SLASHES = /\/+$/;

export const GITLAB_TOKEN_HEADER = 'PRIVATE-TOKEN';

export const GITLAB_RETRY_AFTER_HEADER = 'retry-after';

export const GITLAB_NEXT_PAGE_HEADER = 'x-next-page';

export const GITLAB_PAGE_SIZE = 100;

export const GITLAB_MAX_PAGES = 20;

export const GITLAB_MAX_CONCURRENT_REQUESTS = 8;

export const GITLAB_REQUEST_TIMEOUT_MS = 15_000;

export const GITLAB_NOT_FOUND = 404;

export const GITLAB_TOO_MANY_REQUESTS = 429;

export const GITLAB_SERVER_ERROR = 500;

export const GITLAB_USERS_PATH = '/users';

export const GITLAB_EVENTS_PATH = '/events';

export const GITLAB_PROJECTS_PATH = '/projects';

export const GITLAB_NOTES_PATH = '/notes';

export const GITLAB_LABEL_EVENTS_PATH = '/resource_label_events';

export const GITLAB_STATE_EVENTS_PATH = '/resource_state_events';

export const GITLAB_COMMITS_PATH = '/commits';

export const GITLAB_CLOSES_ISSUES_PATH = '/closes_issues';

export const GITLAB_REPOSITORY_COMMITS_PATH = '/repository/commits';

export const GITLAB_USER_SEARCH_LIMIT = 10;

export const GITLAB_EVENTS_MARGIN_DAYS = 2;

export const GITLAB_CERTIFICATE_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_UNTRUSTED',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);
