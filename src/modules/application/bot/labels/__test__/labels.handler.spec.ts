import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import {
  LabelDimension,
  Priority,
  TaskFlag,
  WorkflowState,
} from 'src/modules/application/label/label.enums';
import type { LabelMapping } from 'src/modules/application/label/label.interface';
import type { LabelService } from 'src/modules/application/label/label.service';
import { JobRole } from 'src/modules/application/user/user.enums';
import { LabelsHandler } from '../labels.handler';

const locale = new I18nService().getLocale(Language.EN);

function mapping(
  index: number,
  values: Partial<LabelMapping> = {},
): LabelMapping {
  return {
    id: `019a4d2e-7c1b-7f3a-9c2d-${String(index).padStart(12, '0')}`,
    label: `level::${index}`,
    labelKey: `level::${index}`,
    role: null,
    dimension: LabelDimension.PRIORITY,
    value: Priority.LOW,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...values,
  };
}

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('LabelsHandler', () => {
  const labelService = {
    countLabels: vi.fn<() => Promise<number>>(),
    findLabelPage:
      vi.fn<(limit: number, offset: number) => Promise<LabelMapping[]>>(),
    findById: vi.fn<(id: string) => Promise<LabelMapping | null>>(),
    findByKey: vi.fn<(labelKey: string) => Promise<LabelMapping[]>>(),
  };
  const handler = new LabelsHandler(labelService as unknown as LabelService);

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
  });

  it('shows an empty list with the add button', async () => {
    labelService.countLabels.mockResolvedValue(0);
    labelService.findLabelPage.mockResolvedValue([]);

    expect(await open(button('lbl:list:0'))).toEqual({
      screen: {
        text: [locale.labelList.title(0), locale.labelList.empty].join('\n'),
        buttons: [
          [
            { text: 'Add', data: 'lbladd:start' },
            { text: 'Menu', data: 'adm:menu' },
          ],
        ],
      },
      dialog: null,
    });
  });

  it('shows a page of labels with their first value', async () => {
    labelService.countLabels.mockResolvedValue(10);
    labelService.findLabelPage.mockResolvedValue([
      mapping(1),
      mapping(2, {
        dimension: LabelDimension.WORKFLOW_STATE,
        value: WorkflowState.BLOCKED,
      }),
    ]);

    const { screen } = await open(button('lbl:list:0'));

    expect(labelService.findLabelPage).toHaveBeenCalledWith(8, 0);
    expect(screen.text).toBe(
      [locale.labelList.title(10), locale.labelList.page(1, 2)].join('\n'),
    );
    expect(screen.buttons).toEqual([
      [{ text: 'level::1 · Low', data: `lbl:card:${mapping(1).id}:0` }],
      [{ text: 'level::2 · Blocked', data: `lbl:card:${mapping(2).id}:0` }],
      [{ text: 'Next ›', data: 'lbl:list:1' }],
      [
        { text: 'Add', data: 'lbladd:start' },
        { text: 'Menu', data: 'adm:menu' },
      ],
    ]);
  });

  it('stays on the last page when asked for a page beyond it', async () => {
    labelService.countLabels.mockResolvedValue(10);
    labelService.findLabelPage.mockResolvedValue([mapping(9)]);

    const { screen } = await open(button('lbl:list:5'));

    expect(labelService.findLabelPage).toHaveBeenCalledWith(8, 8);
    expect(screen.buttons?.[1]).toEqual([
      { text: '‹ Back', data: 'lbl:list:0' },
    ]);
  });

  it('shows what a label means for everyone and for each role', async () => {
    const found = mapping(1, { label: 'status::*easy*' });
    labelService.findById.mockResolvedValue(found);
    labelService.findByKey.mockResolvedValue([
      found,
      mapping(2, {
        role: JobRole.QA,
        dimension: LabelDimension.FLAG,
        value: TaskFlag.REGRESSION,
      }),
      mapping(3, {
        dimension: LabelDimension.WORKFLOW_STATE,
        value: WorkflowState.BLOCKED,
      }),
    ]);

    expect(await open(button(`lbl:card:${found.id}:2`))).toEqual({
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
          [{ text: 'State: Blocked', data: `lblmng:open:${mapping(3).id}` }],
          [{ text: 'Priority: Low', data: `lblmng:open:${found.id}` }],
          [
            {
              text: 'QA · Flag: Regression',
              data: `lblmng:open:${mapping(2).id}`,
            },
          ],
          [{ text: 'Add a value', data: `lbladd:more:${found.id}` }],
          [{ text: 'Delete the label', data: `lblmng:drop:${found.id}` }],
          [{ text: 'To the list', data: 'lbl:list:2' }],
        ],
      },
      dialog: null,
    });
    expect(labelService.findByKey).toHaveBeenCalledWith(found.labelKey);
  });

  it('says a deleted label is not found', async () => {
    labelService.findById.mockResolvedValue(null);

    expect((await open(button(`lbl:card:${mapping(1).id}:0`))).screen).toEqual({
      text: locale.labelList.notFound,
      buttons: [[{ text: 'To the list', data: 'lbl:list:0' }]],
    });
  });

  it.each(['lbl:card:not-an-id:0', 'lbl:list', 'lbl:list:-1', 'lbl:other'])(
    'answers the outdated button %s',
    async (data) => {
      expect((await open(button(data))).screen).toEqual({
        text: locale.bot.expired,
      });
    },
  );

  it('does not take text', async () => {
    expect(
      (await open({ type: ChatInputType.TEXT, text: 'status::easy' })).screen,
    ).toEqual({ text: locale.bot.unknownInput });
  });
});
