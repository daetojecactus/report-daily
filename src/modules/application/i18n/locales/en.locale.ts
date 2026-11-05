import type { Locale } from '../i18n.interface';
import { enCommon } from './en/common.locale';
import { enEmployees } from './en/employees.locale';
import { enTraits } from './en/traits.locale';

export const en: Locale = { ...enCommon, ...enTraits, ...enEmployees };
