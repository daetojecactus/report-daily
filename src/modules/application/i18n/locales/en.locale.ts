import type { Locale } from '../types/i18n.interface';
import { enAi } from './en/ai.locale';
import { enCommon } from './en/common.locale';
import { enEmployees } from './en/employees.locale';
import { enPhrases } from './en/phrases.locale';
import { enTraits } from './en/traits.locale';

export const en: Locale = { ...enCommon, ...enTraits, ...enEmployees, ...enPhrases, ...enAi };
