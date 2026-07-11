import type { TaskStatus, TaskType } from '../../../common/enums/task.enum';

//строка отчета — одна задача
export interface ReportLine {
  title: string;
  status: TaskStatus;
  taskType: TaskType;
  //финальный текст: «Начал работу «Задача»» или AI-описание
  description: string;
  //ссылка на задачу/мр в gitlab (для шаблонов со ссылками)
  webUrl: string | null;
  //приоритет (значение лейбла priority::*), null если не задан
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
