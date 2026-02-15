import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportDailyBotEnvs {
  // App
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  PORT?: number;

  // GitLab
  @IsString()
  GITLAB_API_URL!: string;

  @IsString()
  GITLAB_API_TOKEN!: string;

  // Telegram
  @IsString()
  TELEGRAM_BOT_TOKEN!: string;

  @IsString()
  @IsOptional()
  TELEGRAM_BOT_SECRET_TOKEN?: string;

  @IsString()
  @IsOptional()
  TELEGRAM_ID?: string;

  // OpenRouter
  @IsString()
  OPENROUTER_API_URL!: string;

  @IsString()
  OPENROUTER_API_KEY!: string;

  @IsString()
  OPENROUTER_MODEL!: string;

  // Groq
  @IsString()
  GROQ_API_KEY!: string;

  @IsString()
  GROQ_MODEL!: string;

  // Database
  @IsString()
  MONGODB_URI!: string;
}
