export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function getFailureReason(error: unknown): string {
  if (!(error instanceof Error)) {
    return typeof error;
  }
  const { cause } = error;
  if (
    cause instanceof Error &&
    'code' in cause &&
    typeof cause.code === 'string'
  ) {
    return cause.code;
  }
  return error.name;
}
