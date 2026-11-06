import type { Locale } from '../i18n.interface';
import { ruCommon } from './ru/common.locale';
import { ruEmployees } from './ru/employees.locale';
import { ruTraits } from './ru/traits.locale';

export const ru: Locale = { ...ruCommon, ...ruTraits, ...ruEmployees };
