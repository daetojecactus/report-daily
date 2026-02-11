import { TaskStatus, TaskType } from 'src/common/enums/task.enum';
import {
  GroupedIssue,
  GroupedMergeRequest,
  StandaloneMergeRequest,
  StandalonePush,
} from '../git-group/git-group.interface';

//результат анализа действий — что именно было сделано
export interface WorkResult {
  status: TaskStatus;
  taskType: TaskType;
}

//задача с определенным статусом работы
export interface MappedIssue extends GroupedIssue {
  workResult: WorkResult;
}

//мр с определенным статусом работы
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

//контекст для определения статуса
export interface StatusContext {
  hasCreatedToday: boolean;
  hasClosedToday: boolean;
  hasPushToday: boolean;
  hasCommentToday: boolean;
  hasMergedToday: boolean;
  hasOpenedMrToday: boolean;
  labels: string[];
  mrState?: string;
  issueState?: string;
}
