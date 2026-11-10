import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiService } from 'src/modules/application/ai/ai.service';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { Source } from 'src/modules/application/source/source.enums';
import type { SourceService } from 'src/modules/application/source/source.service';
import type { TraitService } from 'src/modules/application/trait/trait.service';
import type { TraitNameService } from 'src/modules/application/trait/trait-name/trait-name.service';
import type { User } from 'src/modules/application/user/user.interface';
import type { UserSource } from 'src/modules/application/user/user-source/user-source.interface';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { createEmployee } from '../../bot/__test__/bot.fixture';
import type { ActivityService } from '../activity/activity.service';
import { ReportComposer } from '../report.composer';
import type { TemplateContext } from '../template/template.context';
import type { ReportContext, ReportTemplate } from '../template/template.interface';
import type { TemplateRepository } from '../template/template.repository';
import { TemplateService } from '../template/template.service';

const USER = createEmployee().user;
const ACCOUNT = { source: Source.GITLAB, username: 'dev.me' } as UserSource;
function createContext() {
  const items = [
    {
      text: 'Fixed a bug «Login form»',
      actionText: 'Fixed a bug',
      title: 'Login form',
      kind: null,
      type: 'issue',
    },
    {
      text: 'Took 3 tasks into the sprint: #1, #2, #3',
      actionText: 'Took 3 tasks into the sprint',
      title: null,
      kind: null,
      type: 'summary',
    },
  ];
  return { projects: [{ name: 'api', url: null, items }], items } as unknown as ReportContext;
}

const STANDARD = 'api:\n• Fixed a bug «Login form»\n• Took 3 tasks into the sprint: #1, #2, #3';

function template(values: Partial<ReportTemplate>): ReportTemplate {
  return {
    id: '019a4d2e-7c1b-7f3a-9c2d-000000000005',
    name: 'Short',
    body: '{% for project in context.projects %}# {{ project.name }}{% endfor %}',
    ownerId: USER.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...values,
  };
}

describe('ReportComposer', () => {
  const repository = { findOne: vi.fn<TemplateRepository['findOne']>() };
  const aiService = { reword: vi.fn<AiService['reword']>() };
  const composer = new ReportComposer(
    { get: () => 'UTC' } as unknown as ConfigService<AppEnvs, true>,
    {
      collect: () => Promise.resolve({}),
      findNames: () => [],
    } as unknown as SourceService,
    { loadIndex: () => Promise.resolve({}) } as unknown as TraitService,
    { record: () => Promise.resolve() } as unknown as TraitNameService,
    { classify: () => [], summarize: () => [] } as unknown as ActivityService,
    { build: createContext } as unknown as TemplateContext,
    new TemplateService(repository as unknown as TemplateRepository),
    new I18nService(),
    aiService as unknown as AiService,
  );
  const compose = (user: User, ai = false) =>
    composer.compose({ user, account: ACCOUNT, date: '2026-11-09', language: Language.EN, ai });

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders the report in the template the employee chose', async () => {
    repository.findOne.mockResolvedValue(template({}));

    expect(await compose({ ...USER, templateId: template({}).id })).toMatchObject({
      content: '# api',
      templateId: template({}).id,
    });
  });

  it('uses Standard without a choice, for a template of someone else and when the template fails', async () => {
    const standard = { content: STANDARD, templateId: null, aiModel: null };
    expect(await compose(USER)).toMatchObject(standard);

    repository.findOne.mockResolvedValueOnce(template({ ownerId: 'someone-else' }));
    expect(await compose({ ...USER, templateId: template({}).id })).toMatchObject(standard);

    repository.findOne.mockResolvedValueOnce(template({ body: '{{ context.date | missing }}' }));
    expect(await compose({ ...USER, templateId: template({}).id })).toMatchObject(standard);
  });

  it('rewords the lines with a title through AI and keeps the summaries', async () => {
    aiService.reword.mockResolvedValue({
      texts: new Map([['1', 'Fixed a bug in the login form']]),
      model: 'served-model',
    });

    expect(await compose(USER, true)).toMatchObject({
      content: 'api:\n• Fixed a bug in the login form\n• Took 3 tasks into the sprint: #1, #2, #3',
      aiModel: 'served-model',
    });
    expect(aiService.reword).toHaveBeenCalledWith(
      [{ id: '1', action: 'Fixed a bug', title: 'Login form', kind: null }],
      { role: USER.role, gender: USER.gender, locale: new I18nService().getLocale(Language.EN) },
    );
  });

  it('keeps our lines when AI keeps them or the report goes without AI', async () => {
    aiService.reword.mockResolvedValue({ texts: new Map(), model: null });
    expect(await compose(USER, true)).toMatchObject({ content: STANDARD, aiModel: null });

    aiService.reword.mockClear();
    expect(await compose(USER)).toMatchObject({ content: STANDARD, aiModel: null });
    expect(aiService.reword).not.toHaveBeenCalled();
  });
});
