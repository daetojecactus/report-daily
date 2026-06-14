import type { Locale } from './i18n.types';

//локализованный статус пользователя
export function getStatusLabel(status: string, locale: Locale): string {
  return locale.entities.userStatus[status] ?? status;
}

//локализованная роль пользователя
export function getRoleLabel(role: string, locale: Locale): string {
  return locale.entities.userRole[role] ?? role;
}

//локализованное название шаблона
export function getTemplateLabel(template: string, locale: Locale): string {
  return locale.entities.reportTemplate[template] ?? template;
}

//локализованный пол
export function getGenderLabel(gender: string, locale: Locale): string {
  return locale.entities.gender[gender] ?? gender;
}
