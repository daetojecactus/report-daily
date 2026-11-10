import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiService } from 'src/modules/application/ai/ai.service';
import { createEmployee } from 'src/modules/application/bot/__test__/bot.fixture';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { ActivityResult } from '../activity/activity.interface';
import { ReportRewriter } from '../report.rewriter';
import type { ReportContext, TemplateBuild, TemplateItem } from '../template/template.interface';

const locale = new I18nService().getLocale(Language.EN);
const USER = createEmployee().user;

function item(values: Partial<TemplateItem>) {
  return {
    text: 'Fixed a bug «Login form»',
    actionText: 'Fixed a bug',
    title: 'Login form',
    kind: null,
    ...values,
  } as TemplateItem;
}

function result(): ActivityResult {
  return {
    line: {
      issue: { events: [{ noteBody: 'Checked on staging' }, {}] },
      mergeRequests: [{ events: [{ noteBody: 'Fixed the review notes' }] }],
      pushes: [],
      event: null,
    },
    signals: { pushes: [{ commitTitles: ['fix: keep the session'] }, { commitTitles: [] }] },
  } as unknown as ActivityResult;
}

function build(): TemplateBuild {
  const fixed = item({});
  const pushed = item({ text: 'Pushed to main', actionText: 'Pushed to main', title: null });
  return {
    context: { items: [fixed, pushed], ai: { used: false } } as unknown as ReportContext,
    sources: new Map([
      [fixed, result()],
      [pushed, result()],
    ]),
  };
}

describe('ReportRewriter', () => {
  const aiService = { reword: vi.fn<AiService['reword']>() };
  const rewriter = new ReportRewriter(aiService as unknown as AiService);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sends the own commits and comments of a line with a title when the policy allows', async () => {
    aiService.reword.mockResolvedValue({ texts: new Map(), model: null });

    await rewriter.rewrite(build(), USER, locale, { commits: true, comments: true });

    expect(aiService.reword).toHaveBeenCalledWith(
      [
        {
          id: '1',
          action: 'Fixed a bug',
          title: 'Login form',
          kind: null,
          commits: ['fix: keep the session'],
          comments: ['Checked on staging', 'Fixed the review notes'],
        },
      ],
      { role: USER.role, gender: USER.gender, locale },
    );
  });

  it('sends neither commits nor comments when the policy keeps them out', async () => {
    aiService.reword.mockResolvedValue({ texts: new Map(), model: null });

    await rewriter.rewrite(build(), USER, locale, { commits: false, comments: false });

    expect(aiService.reword.mock.calls[0][0]).toMatchObject([{ commits: [], comments: [] }]);
  });

  it('puts the accepted texts into the lines and marks that AI was used', async () => {
    aiService.reword.mockResolvedValue({
      texts: new Map([['1', 'Fixed a bug in the login form']]),
      model: 'served-model',
    });
    const built = build();

    expect(await rewriter.rewrite(built, USER, locale, { commits: false, comments: false })).toBe(
      'served-model',
    );
    expect(built.context.items.map(({ text }) => text)).toEqual([
      'Fixed a bug in the login form',
      'Pushed to main',
    ]);
    expect(built.context.ai.used).toBe(true);
  });

  it('keeps the lines and the mark when AI kept them', async () => {
    aiService.reword.mockResolvedValue({ texts: new Map(), model: null });
    const built = build();

    expect(await rewriter.rewrite(built, USER, locale, { commits: false, comments: false })).toBe(
      null,
    );
    expect(built.context.items[0].text).toBe('Fixed a bug «Login form»');
    expect(built.context.ai.used).toBe(false);
  });
});
