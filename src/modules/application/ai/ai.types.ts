import type { TaskStatus, TaskType } from '../../../common/enums/task.enum';
import type { UserGender } from '../user/user.interface';
import type { Language } from '../../../common/i18n/i18n';

//контекст задачи для AI-обогащения
export interface AITaskContext {
  taskId: string;
  taskTitle: string;
  status: TaskStatus;
  actionVerb: string;
  taskType: TaskType;
  commitMessages: string[];
  comments: string[];
  mrTitle?: string;
}

//параметры запроса к AI
export interface AIEnhanceRequest {
  tasks: AITaskContext[];
  gender: UserGender;
  language: Language;
}
