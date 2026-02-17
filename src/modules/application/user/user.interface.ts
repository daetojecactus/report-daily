export enum UserStatus {
  ACTIVE = 'Active',
  BLOCKED = 'Blocked',
  VACATION = 'Vacation',
}

export enum UserRole {
  DEVELOPER = 'Developer',
  QA = 'QA',
  PROJECT_MANAGER = 'Project Manager',
  ADMIN = 'Admin',
}

export enum UserGender {
  MALE = 'Male',
  FEMALE = 'Female',
}

export interface CreateUserInput {
  adminId: string;
  telegramId: number;
  role: UserRole;
  reportHour: number;
}
