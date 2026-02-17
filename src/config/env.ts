import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportDailyBotEnvs {
  // App
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  PORT?: number;

  @IsString()
  @IsOptional()
  TZ?: string;

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

  @IsNumber()
  @Type(() => Number)
  OWNER_TELEGRAM_ID!: number;

  @IsString()
  @IsOptional()
  TELEGRAM_TRANSPORT?: 'webhook' | 'polling';

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

  // Portal Bitrix24
  @IsString()
  PORTAL_WEBHOOK_URL!: string;

  // Production Calendar
  @IsString()
  PRODUCTION_CALENDAR_BASE_URL!: string;

  // Database
  @IsString()
  MONGODB_URI!: string;
}
