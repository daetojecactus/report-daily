import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { SendMailInput, SendVerificationMailInput } from './mail.intrafce';
import { emailVerificationTemplate } from './constants/mail-verification-code.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async send(input: SendMailInput) {
    try {
      this.logger.log(
        `Sending email to: ${input.to}, subject: ${input.subject}`,
      );
      const result = await this.mailerService.sendMail(input);
      this.logger.log(`Email sent successfully to: ${input.to}`);

      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error(`Failed to send email to: ${input.to}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendVerificationCode(input: SendVerificationMailInput) {
    const message = emailVerificationTemplate(input.code);

    return this.send({
      to: input.to,
      subject: 'Код подтверждения',
      html: message,
      text: `Ваш код подтверждения: ${input.code}`,
    });
  }
}
