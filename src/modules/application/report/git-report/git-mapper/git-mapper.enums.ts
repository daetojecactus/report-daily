//роль пользователя в контексте задачи
export enum TaskRole {
  ASSIGNEE = 'assignee',
  REVIEWER = 'reviewer',
  AUTHOR = 'author',
  OBSERVER = 'observer',
}

export enum EngagementLevel {
  //основной исполнитель/двигатель задачи
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  MINOR = 'minor',
  OBSERVER = 'observer',
}
