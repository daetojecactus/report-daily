import type { TaskStatus, TaskType } from '../../../common/enums/task.enum';
import type { Language } from '../../../common/i18n/i18n';

//строка отчета — одна задача
export interface ReportLine {
  title: string;
  status: TaskStatus;
  taskType: TaskType;
  description: string;
  webUrl: string | null;
  priority: string | null;
}

//проект с задачами
export interface ProjectReport {
  projectName: string;
  lines: ReportLine[];
}

//итоговый отчет за день
export interface DailyReport {
  date: string;
  projects: ProjectReport[];
  text: string;
}

//минимум данных, нужный чтобы сгенерировать и доставить отчёт
export interface ReportRecipient {
  adminId: string;
  telegramId: number;
  language?: Language;
}
