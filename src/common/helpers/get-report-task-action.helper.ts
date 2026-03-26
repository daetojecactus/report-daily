import { UserGender } from 'src/modules/application/user/user.interface';
import { TaskStatus } from '../enums/task.enum';
import { Language, getLocale } from '../i18n/i18n';

//получить действие с учетом пола пользователя и языка
export function getReportTaskAction(
  status: TaskStatus,
  gender: UserGender,
  language: Language = Language.RU,
): string {
  const locale = getLocale(language);
  const action =
    locale.taskActions[status] ?? locale.taskActions[TaskStatus.UNKNOWN];
  return gender === UserGender.FEMALE ? action.female : action.male;
}
