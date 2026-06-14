//данные для задачи рассылки одному пользователю
export interface BroadcastJobData {
  telegramId: number;
  text: string;
}

//результат обработки задачи рассылки
export interface BroadcastJobResult {
  telegramId: number;
  success: boolean;
  error?: string;
}
