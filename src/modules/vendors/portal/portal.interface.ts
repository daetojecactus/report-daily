import { PortalAccessibilityType, PortalImportanceType } from './portal.type';

//пользователь Bitrix24
export interface PortalUser {
  ID: string;
  ACTIVE: boolean;
  NAME: string;
  LAST_NAME: string;
  SECOND_NAME: string;
  EMAIL: string;
  PERSONAL_GENDER: string;
  PERSONAL_PHONE: string;
  WORK_POSITION: string;
  UF_DEPARTMENT: number[];
}

//обертка ответа Bitrix24 REST API
export interface PortalResponse<T> {
  result: T;
  total?: number;
  next?: number;
}

//статус занятости пользователя для календаря
export interface PortalAccessibility {
  ID: string;
  FROM_HR: boolean;
  ACCESSIBILITY: PortalAccessibilityType;
  IMPORTANCE: PortalImportanceType;
  DT_FROM: string;
  DT_TO: string;
  FROM: number;
  TO: number;
}
