import { IsString, IsInt, IsBoolean } from 'class-validator';

export class ReportDailyBotEnvs {
  @IsString()
  GITLAB_API_URL!: string;

  @IsString()
  GITLAB_API_TOKEN!: string;

  @IsString()
  TELEGRAM_BOT_TOKEN!: string;

  @IsString()
  TELEGRAM_BOT_SECRET_TOKEN!: string;

  @IsString()
  GROQ_MODEL!: string;

  @IsString()
  GROQ_API_KEY!: string;

  @IsString()
  MONGODB_URI!: string;

  @IsString()
  MAIL_HOST!: string;

  @IsInt()
  MAIL_PORT!: number;

  @IsBoolean()
  MAIL_SECURE!: boolean;

  @IsString()
  MAIL_USER!: string;

  @IsString()
  MAIL_PASSWORD!: string;

  @IsString()
  MAIL_FROM_NAME!: string;
}
