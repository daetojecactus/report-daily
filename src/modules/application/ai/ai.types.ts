import { TaskStatus, TaskType } from '../../../common/enums/task.enum';
import { UserGender } from '../user/user.interface';

//контекст задачи для AI-обогащения
export interface AITaskContext {
  taskId: string;
  taskTitle: string;
  status: TaskStatus;
  commitMessages: string[];
  comments: string[];
  taskType: TaskType;
  labels: string[];
  mrBranch?: string;
  mrTitle?: string;
}

//параметры запроса к AI
export interface AIEnhanceRequest {
  tasks: AITaskContext[];
  gender: UserGender;
}
