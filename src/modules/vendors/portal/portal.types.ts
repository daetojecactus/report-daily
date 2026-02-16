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

//запись графика отсутствий
export interface PortalAbsence {
  ID: string;
  USER_ID: string;
  DATE_FROM: string;
  DATE_TO: string;
  DT_FROM: string;
  DT_TO: string;
  ABSENCE_TYPE: string;
  ACTIVE: boolean;
}

//обёртка ответа Bitrix24 REST API
export interface PortalResponse<T> {
  result: T;
  total?: number;
  next?: number;
}
