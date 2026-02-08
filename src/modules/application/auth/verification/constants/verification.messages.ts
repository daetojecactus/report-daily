export enum VerificationMessages {
  VERIFICATION_NOT_FOUND = 'Verification code not found or expired. Request a new one.',
  VERIFICATION_MAX_ATTEMPTS = 'Maximum attempts exceeded. Request a new code.',
  VERIFICATION_ALREADY_EXISTS = 'A verification code already exists for this user. Please check your email.',
  VERIFICATION_CODE_SENT = 'Verification code sent to your corporate email.',
  VERIFICATION_INVALID_CODE = 'Invalid code. Remaining attempts: ',
  VERIFICATION_SUCCESS = 'Email verified! Welcome.',
}
