import {
  TaskStatus,
  TaskType,
  TaskAction,
} from '../../../common/enums/task.enum';
import { GitLabIssueState } from '../../../common/enums/gitlab.enum';
import type { MRInfo, AIContext } from '../git/git.types';

export interface TaskActionInfo {
  type: TaskAction;
  count: number;
}

export interface TaskInfo {
  title: string;
  state: GitLabIssueState;
  labels: string[];
  createdAt: Date;
  taskType: TaskType;
}

export interface TaskGroup {
  taskId: number;
  projectId: number;
  taskTitle: string;
  actions: TaskActionInfo[];
  status: TaskStatus;
  taskInfo?: TaskInfo;
  mrInfo?: MRInfo;
  aiContext?: AIContext;
  aiDescription?: string;
}

export interface ProjectReport {
  projectId: number;
  projectName: string;
  tasks: TaskGroup[];
}

export interface DailyReport {
  date: Date;
  projects: ProjectReport[];
}
