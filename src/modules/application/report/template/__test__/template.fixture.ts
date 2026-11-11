import type { ConfigService } from '@nestjs/config';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { GroupedDailyData } from 'src/modules/application/source/types/source.interface';
import { Gender, JobRole } from 'src/modules/application/user/types/user.enums';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { createIndex, createService, ME } from '../../activity/__test__/activity.fixture';
import { PhraseService } from '../../phrase/phrase.service';
import { TemplateContext } from '../template.context';

export const GITLAB_URL = 'https://gitlab.example.com';

const CONFIG = { get: () => GITLAB_URL } as unknown as ConfigService<AppEnvs, true>;

export function createDay(overrides: Partial<GroupedDailyData> = {}): GroupedDailyData {
  return {
    projects: [1, 2].map((id) => ({
      id,
      name: `project-${id}`,
      path: `group/project-${id}`,
      webUrl: `${GITLAB_URL}/group/project-${id}`,
    })),
    issues: [],
    standaloneMergeRequests: [],
    standalonePushes: [],
    standaloneEvents: [],
    ...overrides,
  };
}

export function buildContext(
  day: GroupedDailyData,
  {
    role = JobRole.DEVELOPER,
    language = Language.RU,
    date = '2026-11-09',
    username = ME,
    index = createIndex(),
  } = {},
) {
  const service = createService();
  const results = service.classify(day, { username, role }, index);
  return new TemplateContext(CONFIG, service, new PhraseService()).build(
    {
      date,
      language,
      employee: { name: 'Dev Me', username, role, gender: Gender.MALE },
      day,
      results,
      summaries: service.summarize(results),
    },
    new I18nService().getLocale(language),
  );
}
