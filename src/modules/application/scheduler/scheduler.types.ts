//результат обработки одного пользователя в батче
export interface BatchUserResult {
  adminId: string;
  telegramId: number;
  success: boolean;
  error?: string;
}
