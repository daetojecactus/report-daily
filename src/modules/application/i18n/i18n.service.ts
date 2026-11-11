import { Injectable } from '@nestjs/common';
import { DEFAULT_LANGUAGE, LANGUAGE_TAG_SEPARATOR, LOCALES } from './constants/i18n.constants';
import { Language } from './types/i18n.enums';

@Injectable()
export class I18nService {
  getLocale(language: Language) {
    return LOCALES[language];
  }

  resolveLanguage(languageCode: string | null) {
    const primary = languageCode?.split(LANGUAGE_TAG_SEPARATOR)[0].toLowerCase();

    return Object.values(Language).find((language) => language === primary) ?? DEFAULT_LANGUAGE;
  }
}
