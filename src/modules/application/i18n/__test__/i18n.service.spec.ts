import { describe, expect, it } from 'vitest';
import { Gender } from 'src/modules/application/user/user.enums';
import { DEFAULT_LANGUAGE } from '../constants/i18n.constants';
import { Language } from '../i18n.enums';
import { I18nService } from '../i18n.service';

const i18nService = new I18nService();

const LANGUAGES = Object.values(Language);

const NAMES = [
  'channels.',
  'sources.',
  'languages.',
  'settings.ai.name',
  'traits.values.area.api.name',
  'traits.values.area.ci_cd.name',
  'roles.qa',
  'roles.devops',
  'phrases.withNote',
];

const GENDERS: string[] = Object.values(Gender);

function isGendered(value: object) {
  const keys = Object.keys(value);
  return keys.length === GENDERS.length && keys.every((key) => GENDERS.includes(key));
}

function collectEntries(value: unknown, path = ''): [string, unknown][] {
  if (typeof value !== 'object' || value === null) {
    return [[path, value]];
  }
  if (isGendered(value)) {
    return [[path, Object.values(value).join(' / ')]];
  }
  return Object.entries(value).flatMap(([key, item]) =>
    collectEntries(item, path ? `${path}.${key}` : key),
  );
}

function describeEntries(language: Language) {
  return collectEntries(i18nService.getLocale(language)).map(([path, value]): [string, string] => [
    path,
    typeof value === 'function' ? `function/${value.length}` : typeof value,
  ]);
}

function renderTexts(language: Language) {
  return collectEntries(i18nService.getLocale(language)).map(([path, value]): [string, string] => [
    path,
    typeof value === 'function'
      ? String((value as (...args: string[]) => unknown)('Telegram', '1'))
      : String(value),
  ]);
}

describe('I18nService', () => {
  it.each(LANGUAGES)('locale %s has the same keys as the default locale', (language) => {
    expect(describeEntries(language)).toEqual(describeEntries(DEFAULT_LANGUAGE));
  });

  it.each(LANGUAGES)('locale %s has no empty or padded texts', (language) => {
    const invalid = renderTexts(language).filter(
      ([, text]) => text.trim() === '' || text.trim() !== text,
    );

    expect(invalid).toEqual([]);
  });

  it('locales differ in every text except names', () => {
    const russian = new Map(renderTexts(Language.RU));
    const same = renderTexts(Language.EN).filter(
      ([path, text]) => !NAMES.some((name) => path.startsWith(name)) && russian.get(path) === text,
    );

    expect(same).toEqual([]);
  });

  it.each([
    ['ru', Language.RU],
    ['ru-RU', Language.RU],
    ['EN', Language.EN],
    ['en-GB', Language.EN],
    ['kk', DEFAULT_LANGUAGE],
    [null, DEFAULT_LANGUAGE],
  ])('resolves language code %s', (code, language) => {
    expect(i18nService.resolveLanguage(code)).toBe(language);
  });
});
