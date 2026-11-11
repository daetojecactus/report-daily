import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { Source } from 'src/modules/application/source/types/source.enums';
import {
  TraitDimension,
  Priority,
  TaskFlag,
  WorkflowState,
} from 'src/modules/application/trait/types/trait.enums';
import type { TraitMapping } from 'src/modules/application/trait/types/trait.interface';
import type { TraitService } from 'src/modules/application/trait/trait.service';
import type { TraitNameService } from 'src/modules/application/trait/trait-name/trait-name.service';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { TraitsHandler } from '../traits.handler';
import { TraitsView } from '../traits.view';

const locale = new I18nService().getLocale(Language.EN);

function mapping(index: number, values: Partial<TraitMapping> = {}): TraitMapping {
  return {
    id: `019a4d2e-7c1b-7f3a-9c2d-${String(index).padStart(12, '0')}`,
    source: Source.GITLAB,
    sourceName: `level::${index}`,
    sourceKey: `level::${index}`,
    role: null,
    dimension: TraitDimension.PRIORITY,
    value: Priority.LOW,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...values,
  };
}

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('TraitsHandler', () => {
  const traitService = {
    countSourceNames: vi.fn<() => Promise<number>>(),
    findSourceNamePage: vi.fn<(limit: number, offset: number) => Promise<TraitMapping[]>>(),
    findById: vi.fn<(id: string) => Promise<TraitMapping | null>>(),
    findByKey: vi.fn<(source: Source, sourceKey: string) => Promise<TraitMapping[]>>(),
  };
  const traitNameService = {
    countUnmapped: vi.fn<(source: Source, ignored: boolean) => Promise<number>>(),
  };
  const handler = new TraitsHandler(
    traitService as unknown as TraitService,
    traitNameService as unknown as TraitNameService,
    new TraitsView(),
  );

  function open(input: ChatInput) {
    return handler.handle({
      actor: {
        channel: Channel.TELEGRAM,
        externalId: '1',
        chatId: '1',
        language: Language.EN,
        isOwner: true,
        user: null,
      },
      locale,
      input,
      dialog: null,
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    traitNameService.countUnmapped.mockResolvedValue(3);
  });

  it('shows an empty list with the add button', async () => {
    traitService.countSourceNames.mockResolvedValue(0);
    traitService.findSourceNamePage.mockResolvedValue([]);

    expect(await open(button('trt:list:0'))).toEqual({
      screen: {
        text: [locale.traitList.title(0), locale.traitList.empty].join('\n'),
        buttons: [
          [{ text: 'No traits · 3', data: 'trtnm:list:new:0' }],
          [
            { text: 'Add', data: 'trtadd:start' },
            { text: 'Menu', data: 'adm:menu' },
          ],
        ],
      },
      dialog: null,
    });
  });

  it('shows a page of labels with their first value', async () => {
    traitService.countSourceNames.mockResolvedValue(10);
    traitService.findSourceNamePage.mockResolvedValue([
      mapping(1),
      mapping(2, {
        dimension: TraitDimension.WORKFLOW_STATE,
        value: WorkflowState.BLOCKED,
      }),
    ]);

    const { screen } = await open(button('trt:list:0'));

    expect(traitService.findSourceNamePage).toHaveBeenCalledWith(8, 0);
    expect(traitNameService.countUnmapped).toHaveBeenCalledWith(Source.GITLAB, false);
    expect(screen.text).toBe([locale.traitList.title(10), locale.traitList.page(1, 2)].join('\n'));
    expect(screen.buttons).toEqual([
      [{ text: 'level::1 · Low', data: `trt:card:${mapping(1).id}:0` }],
      [{ text: 'level::2 · Blocked', data: `trt:card:${mapping(2).id}:0` }],
      [{ text: 'Next', data: 'trt:list:1' }],
      [{ text: 'No traits · 3', data: 'trtnm:list:new:0' }],
      [
        { text: 'Add', data: 'trtadd:start' },
        { text: 'Menu', data: 'adm:menu' },
      ],
    ]);
  });

  it('stays on the last page when asked for a page beyond it', async () => {
    traitService.countSourceNames.mockResolvedValue(10);
    traitService.findSourceNamePage.mockResolvedValue([mapping(9)]);

    const { screen } = await open(button('trt:list:5'));

    expect(traitService.findSourceNamePage).toHaveBeenCalledWith(8, 8);
    expect(screen.buttons?.[1]).toEqual([{ text: 'Back', data: 'trt:list:0' }]);
  });

  it('shows what a label means for everyone and for each role', async () => {
    const found = mapping(1, { sourceName: 'status::*easy*' });
    traitService.findById.mockResolvedValue(found);
    traitService.findByKey.mockResolvedValue([
      found,
      mapping(2, {
        role: JobRole.QA,
        dimension: TraitDimension.FLAG,
        value: TaskFlag.REGRESSION,
      }),
      mapping(3, {
        dimension: TraitDimension.WORKFLOW_STATE,
        value: WorkflowState.BLOCKED,
      }),
    ]);

    expect(await open(button(`trt:card:${found.id}:2`))).toEqual({
      screen: {
        text: [
          '**status::\\*easy\\***',
          '',
          'For everyone:',
          '• State: Blocked',
          '• Priority: Low',
          '',
          'QA:',
          '• Flag: Regression',
        ].join('\n'),
        buttons: [
          [{ text: 'State: Blocked', data: `trtmng:open:${mapping(3).id}` }],
          [{ text: 'Priority: Low', data: `trtmng:open:${found.id}` }],
          [
            {
              text: 'QA · Flag: Regression',
              data: `trtmng:open:${mapping(2).id}`,
            },
          ],
          [{ text: 'Add a trait', data: `trtadd:more:${found.id}` }],
          [{ text: 'Delete the label', data: `trtmng:drop:${found.id}` }],
          [{ text: 'To the list', data: 'trt:list:2' }],
        ],
      },
      dialog: null,
    });
    expect(traitService.findByKey).toHaveBeenCalledWith(Source.GITLAB, found.sourceKey);
  });

  it('says a deleted label is not found', async () => {
    traitService.findById.mockResolvedValue(null);

    expect((await open(button(`trt:card:${mapping(1).id}:0`))).screen).toEqual({
      text: locale.traitList.notFound,
      buttons: [[{ text: 'To the list', data: 'trt:list:0' }]],
    });
  });

  it.each(['trt:card:not-an-id:0', 'trt:list', 'trt:list:-1', 'trt:other'])(
    'answers the outdated button %s',
    async (data) => {
      expect((await open(button(data))).screen).toEqual({
        text: locale.bot.expired,
      });
    },
  );

  it('does not take text', async () => {
    expect((await open({ type: ChatInputType.TEXT, text: 'status::easy' })).screen).toEqual({
      text: locale.bot.unknownInput,
    });
  });
});
