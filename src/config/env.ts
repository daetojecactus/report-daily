import { IsString } from 'class-validator';

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
}
