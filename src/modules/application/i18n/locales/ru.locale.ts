import type { Locale } from '../i18n.interface';
import { ruAi } from './ru/ai.locale';
import { ruCommon } from './ru/common.locale';
import { ruEmployees } from './ru/employees.locale';
import { ruPhrases } from './ru/phrases.locale';
import { ruTraits } from './ru/traits.locale';

export const ru: Locale = { ...ruCommon, ...ruTraits, ...ruEmployees, ...ruPhrases, ...ruAi };
