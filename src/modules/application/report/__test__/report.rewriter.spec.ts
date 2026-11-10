import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiPolicy } from 'src/modules/application/ai/ai.interface';
import type { AiService } from 'src/modules/application/ai/ai.service';
import { createEmployee } from 'src/modules/application/bot/__test__/bot.fixture';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { SourceActionKind } from 'src/modules/application/source/source.enums';
import { TraitDimension, WorkflowState } from 'src/modules/application/trait/trait.enums';
import type { TraitIndex } from 'src/modules/application/trait/trait.interface';
import type { TraitRepository } from 'src/modules/application/trait/trait.repository';
import { TraitService } from 'src/modules/application/trait/trait.service';
import type { TraitNameService } from 'src/modules/application/trait/trait-name/trait-name.service';
import { ActivityAction, ActivityDetail } from '../activity/activity.enums';
import type { ActivityCandidate, ActivityResult } from '../activity/activity.interface';
import { ReportRewriter } from '../report.rewriter';
import type { ReportContext, TemplateBuild, TemplateItem } from '../template/template.interface';

const locale = new I18nService().getLocale(Language.EN);
const USER = createEmployee().user;
const NONE: AiPolicy = { commits: false, comments: false };
const INDEX: TraitIndex = {
  pairs: new Map([
    [
      'status::testing',
      [{ dimension: TraitDimension.WORKFLOW_STATE, value: WorkflowState.TESTING }],
    ],
  ]),
  ignored: new Set(),
};

function item(values: Partial<TemplateItem>) {
  return {
    text: 'Fixed a bug «Login form»',
    actionText: 'Fixed a bug',
    title: 'Login form',
    kind: null,
    ...values,
  } as TemplateItem;
}

function fact(kind: SourceActionKind, value: string) {
  return { kind, value };
}

function result(main: Partial<ActivityCandidate> = {}): ActivityResult {
  return {
    line: {
      issue: { events: [{ noteBody: 'Checked on staging' }, {}] },
      mergeRequests: [{ events: [{ noteBody: 'Fixed the review notes' }] }],
      pushes: [],
      event: null,
    },
    signals: { pushes: [{ commitTitles: ['fix: keep the session'] }, { commitTitles: [] }] },
    choice: { main: { action: ActivityAction.COMPLETED, details: [], facts: [], ...main } },
  } as unknown as ActivityResult;
}

function build(main?: Partial<ActivityCandidate>): TemplateBuild {
  const fixed = item({});
  const pushed = item({ text: 'Pushed to main', actionText: 'Pushed to main', title: null });
  return {
    context: { items: [fixed, pushed], ai: { used: false } } as unknown as ReportContext,
    sources: new Map([
      [fixed, result(main)],
      [pushed, result()],
    ]),
  };
}

describe('ReportRewriter', () => {
  const aiService = { reword: vi.fn<AiService['reword']>() };
  const rewriter = new ReportRewriter(
    aiService as unknown as AiService,
    new TraitService({} as TraitRepository, {} as TraitNameService),
  );
  const rewrite = (built: TemplateBuild, policy = NONE) =>
    rewriter.rewrite(built, { user: USER, locale, policy, index: INDEX });

  beforeEach(() => {
    vi.resetAllMocks();
    aiService.reword.mockResolvedValue({ texts: new Map(), model: null });
  });

  it('sends the own commits and comments of a line with a title when the policy allows', async () => {
    await rewrite(build(), { commits: true, comments: true });

    expect(aiService.reword).toHaveBeenCalledWith(
      [
        {
          id: '1',
          action: 'Fixed a bug',
          title: 'Login form',
          kind: null,
          commits: ['fix: keep the session'],
          comments: ['Checked on staging', 'Fixed the review notes'],
          names: null,
        },
      ],
      { role: USER.role, gender: USER.gender, locale },
    );
  });

  it('sends neither commits nor comments when the policy keeps them out', async () => {
    await rewrite(build());

    expect(aiService.reword.mock.calls[0][0]).toMatchObject([{ commits: [], comments: [] }]);
  });

  it('sends the label and status names the bot did not understand for an edit line', async () => {
    await rewrite(
      build({
        action: ActivityAction.EDITED,
        details: [ActivityDetail.LABELS],
        facts: [
          fact(SourceActionKind.LABEL_ADDED, 'stage::ready-for-qa'),
          fact(SourceActionKind.LABEL_ADDED, 'status::testing'),
          fact(SourceActionKind.LABEL_REMOVED, 'stage::dev'),
          fact(SourceActionKind.STATUS_SET, 'Waiting'),
          fact(SourceActionKind.LABEL_ADDED, 'stage::ready-for-qa'),
        ],
      } as Partial<ActivityCandidate>),
    );

    expect(aiService.reword.mock.calls[0][0][0].names).toEqual({
      added: ['stage::ready-for-qa', 'Waiting'],
      removed: ['stage::dev'],
    });
  });

  it.each([
    ['another action', { action: ActivityAction.COMPLETED, details: [] }],
    ['an edit of the title', { action: ActivityAction.EDITED, details: [ActivityDetail.TITLE] }],
  ])('sends no names for %s', async (_, main) => {
    await rewrite(
      build({
        ...main,
        facts: [fact(SourceActionKind.LABEL_ADDED, 'stage::x')],
      } as Partial<ActivityCandidate>),
    );

    expect(aiService.reword.mock.calls[0][0][0].names).toBeNull();
  });

  it('sends no names when every name is understood', async () => {
    await rewrite(
      build({
        action: ActivityAction.EDITED,
        details: [ActivityDetail.LABELS],
        facts: [fact(SourceActionKind.LABEL_ADDED, 'Status::Testing')],
      } as Partial<ActivityCandidate>),
    );

    expect(aiService.reword.mock.calls[0][0][0].names).toBeNull();
  });

  it('puts the accepted texts into the lines and marks that AI was used', async () => {
    aiService.reword.mockResolvedValue({
      texts: new Map([['1', 'Fixed a bug in the login form']]),
      model: 'served-model',
    });
    const built = build();

    expect(await rewrite(built)).toBe('served-model');
    expect(built.context.items.map(({ text }) => text)).toEqual([
      'Fixed a bug in the login form',
      'Pushed to main',
    ]);
    expect(built.context.ai.used).toBe(true);
  });

  it('keeps the lines and the mark when AI kept them', async () => {
    const built = build();

    expect(await rewrite(built)).toBeNull();
    expect(built.context.items[0].text).toBe('Fixed a bug «Login form»');
    expect(built.context.ai.used).toBe(false);
  });
});
