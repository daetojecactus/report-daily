export { Language } from '../../../common/i18n/i18n';

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

export enum ReportTemplate {
  STANDARD = 'Standard',
  QA = 'QA',
}

export interface CreateUserInput {
  adminId: string;
  telegramId: number;
  role: UserRole;
  reportHour: number;
}
