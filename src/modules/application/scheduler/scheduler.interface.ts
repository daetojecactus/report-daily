//результат обработки одного пользователя в батче
export interface BatchUserResult {
  adminId: string;
  telegramId: number;
  success: boolean;
  error?: string;
}

//сводка ручной рассылки отчётов за несколько прошлых дней
export interface RecentReportsSummary {
  days: number;
  dates: string[];
  users: number;
  sent: number;
  failed: number;
  results: BatchUserResult[];
}
