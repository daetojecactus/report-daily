import { Language, getLocale } from 'src/common/i18n/i18n';
import type { Locale } from 'src/common/i18n/i18n.types';

//у пользователя может не быть настроек (старые записи) — язык по умолчанию русский
type LanguageAware = { settings?: { language?: Language } | null };

export function resolveUserLanguage(user: LanguageAware): Language {
  return user.settings?.language ?? Language.RU;
}

export function resolveUserLocale(user: LanguageAware): Locale {
  return getLocale(resolveUserLanguage(user));
}
