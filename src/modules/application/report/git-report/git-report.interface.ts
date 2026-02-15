import { TaskStatus, TaskType } from 'src/common/enums/task.enum';

//один элемент отчета — задача/мр/пуш с обогащенным контекстом
export interface ReportTaskItem {
  //уникальный ключ задачи (projectId:iid)
  taskKey: string;
  projectId: number;
  iid: number;
  title: string;
  webUrl: string | null;
  status: TaskStatus;
  taskType: TaskType;
  labels: string[];
  //контекст для AI (коммиты и комменты)
  aiContext: ReportAIContext;
}

//контекст для нейронки — коммиты и комментарии пользователя
export interface ReportAIContext {
  commitMessages: string[];
  userComments: string[];
  mrTitle: string | null;
}

//проект с задачами за день
export interface ProjectReportGroup {
  projectId: number;
  projectName: string;
  tasks: ReportTaskItem[];
}

//полный отчет за день из git-данных
export interface GitDailyReport {
  date: string;
  projects: ProjectReportGroup[];
}
