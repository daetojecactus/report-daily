import { TaskStatus, TaskType } from 'src/common/enums/task.enum';
import {
  GroupedIssue,
  StandaloneMergeRequest,
  StandalonePush,
} from '../git-group/git-group.interface';

//роль пользователя в контексте задачи
export enum TaskRole {
  ASSIGNEE = 'assignee',
  REVIEWER = 'reviewer',
  OBSERVER = 'observer',
}

//результат анализа действий — что именно было сделано
export interface WorkResult {
  status: TaskStatus;
  taskType: TaskType;
}

//задача с определенным статусом работы
export interface MappedIssue extends GroupedIssue {
  workResult: WorkResult;
}

//MR с определенным статусом работы (хотфиксы и т.д. без задачи)
export interface MappedMergeRequest extends StandaloneMergeRequest {
  workResult: WorkResult;
}

//пуш с определенным статусом работы
export interface MappedPush extends StandalonePush {
  workResult: WorkResult;
}

//полностью обработанные данные за день
export interface MappedDailyData {
  issues: MappedIssue[];
  standaloneMergeRequests: MappedMergeRequest[];
  standalonePushes: MappedPush[];
}
