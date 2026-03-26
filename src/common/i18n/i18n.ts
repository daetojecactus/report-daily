import { Language } from './i18n.types';
import { ru } from './locales/ru.locale';
import { en } from './locales/en.locale';
import type { Locale } from './i18n.types';

const locales: Record<Language, Locale> = {
  [Language.RU]: ru,
  [Language.EN]: en,
};

//получить локаль по языку (fallback — русский)
export function getLocale(language: Language): Locale {
  return locales[language] ?? locales[Language.RU];
}

export { Language, type Locale, type GenderedText } from './i18n.types';
