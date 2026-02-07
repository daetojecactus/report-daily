import { TaskStatus, TaskType } from '../../../common/enums/task.enum';

export interface AITaskContext {
  taskId: number;
  taskTitle: string;
  status: TaskStatus;
  commitMessages: string[];
  comments: string[];
  taskType: TaskType;
  labels: string[];
  mrBranch?: string;
  mrTitle?: string;
}
