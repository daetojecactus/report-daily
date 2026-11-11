import type { CommonLocale } from './i18n-common.interface';
import type { TraitsLocale } from './i18n-traits.interface';
import type { EmployeesLocale } from './i18n-employees.interface';
import type { PhrasesLocale } from './i18n-phrases.interface';
import type { AiLocale } from './i18n-ai.interface';

export type Locale = CommonLocale & TraitsLocale & EmployeesLocale & PhrasesLocale & AiLocale;
