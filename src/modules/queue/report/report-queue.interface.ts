import type { Language } from 'src/common/i18n/i18n';

//данные для задачи генерации и отправки отчёта
export interface ReportJobData {
  adminId: string;
  telegramId: number;
  date: string;
  language: Language;
}

//результат обработки задачи
export interface ReportJobResult {
  adminId: string;
  telegramId: number;
  success: boolean;
  error?: string;
}
