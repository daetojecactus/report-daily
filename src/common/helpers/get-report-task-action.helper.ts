import { UserGender } from 'src/modules/application/user/user.interface';
import { TaskStatus } from '../enums/task.enum';
import { REPORT_TASK_ACTIONS } from 'src/modules/application/report/constants/report-task-actions.constants';

//получить действие с учетом пола пользователя
export function getReportTaskAction(
  status: TaskStatus,
  gender: UserGender,
): string {
  const action =
    REPORT_TASK_ACTIONS[status] ?? REPORT_TASK_ACTIONS[TaskStatus.UNKNOWN];
  return gender === UserGender.FEMALE ? action.female : action.male;
}
