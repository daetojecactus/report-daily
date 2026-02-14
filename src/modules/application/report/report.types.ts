import { TaskStatus, TaskType } from '../../../common/enums/task.enum';

//строка отчёта — одна задача
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

//итоговый отчёт за день
export interface DailyReport {
  date: string;
  projects: ProjectReport[];
  //отформатированный текст для отправки (project:\n• description)
  text: string;
}
