export enum GitLabMessages {
  REQUEST_FAILED = 'GitLab request failed',
  INVALID_RESPONSE = 'GitLab returned an invalid response',
  API_ERROR = 'GitLab API error',
  PAGE_LIMIT_REACHED = 'GitLab list has more pages than the limit, the rest is skipped',
  CERTIFICATE_UNTRUSTED = 'GitLab certificate is not trusted, set NODE_EXTRA_CA_CERTS to the CA certificate',
}
