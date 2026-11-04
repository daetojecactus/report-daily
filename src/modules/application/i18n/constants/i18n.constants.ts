import { Language } from '../i18n.enums';
import type { Locale } from '../i18n.interface';
import { en } from '../locales/en.locale';
import { ru } from '../locales/ru.locale';

export const DEFAULT_LANGUAGE = Language.EN;

export const LANGUAGE_TAG_SEPARATOR = '-';

export const LOCALES: Record<Language, Locale> = {
  [Language.RU]: ru,
  [Language.EN]: en,
};
