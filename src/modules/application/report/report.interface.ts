import type { TaskStatus, TaskType } from '../../../common/enums/task.enum';

//строка отчета — одна задача
export interface ReportLine {
  title: string;
  status: TaskStatus;
  taskType: TaskType;
  //финальный текст: «Начал работу «Задача»» или AI-описание
  description: string;
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
