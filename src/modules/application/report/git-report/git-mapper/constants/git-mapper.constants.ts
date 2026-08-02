//порог дней для определения «вернулся к работе»
export const GIT_MAPPER_DAYS_THRESHOLD_RESUMED_WORK = 7;

//порог для «много комментариев» блокирующее ревью
export const GIT_MAPPER_MANY_COMMENTS_THRESHOLD = 3;

//признаки работы над тестами в заголовке коммита
export const GIT_MAPPER_TEST_COMMIT_PATTERN =
  /\b(test|tests|testing|e2e|spec|specs|autotest|autotests|pom|fixture|fixtures|cypress|playwright|selenium|тест|тесты|автотест|автотесты)\b/i;

//веса сигналов для расчёта степени вовлеченности в задачу
export const ENGAGEMENT_WEIGHTS = {
  //назначен исполнителем
  ASSIGNEE: 5,
  //назначен ревьюером
  REVIEWER: 5,
  //автор мерж-реквеста
  MERGE_REQUEST_AUTHOR: 4,
  //смерджил мерж-реквест
  MERGED: 4,
  //автор задачи
  ISSUE_AUTHOR: 2,
  //за каждый коммит
  PER_COMMIT: 1,
  //за каждый комментарий
  PER_COMMENT: 0.5,
  //за каждую смену лейбла
  PER_STATUS_CHANGE: 1,
  //эскалация приоритета
  PRIORITY_ESCALATION: 1,
} as const;

//ограничения: без них перекладывание лейблов туда-сюда вытягивает на уровень основного исполнителя
export const ENGAGEMENT_COMMIT_CAP = 5;
export const ENGAGEMENT_COMMENT_CAP = 4;
export const ENGAGEMENT_STATUS_CHANGE_CAP = 3;

//пороги уровней вовлеченности
export const ENGAGEMENT_THRESHOLDS = {
  PRIMARY: 5,
  SECONDARY: 2.5,
  MINOR: 0.5,
} as const;
