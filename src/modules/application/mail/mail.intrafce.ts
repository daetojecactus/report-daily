export interface SendVerificationMailInput {
  to: string;
  code: string;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}
