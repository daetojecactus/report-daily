import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import {
  LabelDimension,
  Priority,
  TaskFlag,
} from 'src/modules/application/label/label.enums';
import type {
  LabelMapping,
  LabelValue,
} from 'src/modules/application/label/label.interface';
import type { LabelService } from 'src/modules/application/label/label.service';
import { JobRole } from 'src/modules/application/user/user.enums';
import { LabelManageHandler } from '../label-manage.handler';

const locale = new I18nService().getLocale(Language.EN);
const BOLD = '**status::easy**';
const MAPPING: LabelMapping = {
  id: '019a4d2e-7c1b-7f3a-9c2d-000000000001',
  label: 'status::easy',
  labelKey: 'status::easy',
  role: null,
  dimension: LabelDimension.PRIORITY,
  value: Priority.LOW,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const OTHER: LabelMapping = {
  ...MAPPING,
  id: '019a4d2e-7c1b-7f3a-9c2d-000000000002',
  role: JobRole.QA,
  dimension: LabelDimension.FLAG,
  value: TaskFlag.REGRESSION,
};
const CARD = { text: 'Open the card', data: `lbl:card:${MAPPING.id}:0` };
const LIST = { text: 'To the list', data: 'lbl:list:0' };

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('LabelManageHandler', () => {
  const labelService = {
    findById: vi.fn<(id: string) => Promise<LabelMapping | null>>(),
    findByKey: vi.fn<(labelKey: string) => Promise<LabelMapping[]>>(),
    changeValue:
      vi.fn<(id: string, value: LabelValue) => Promise<LabelMapping | null>>(),
    deleteById: vi.fn<(id: string) => Promise<LabelMapping | null>>(),
    deleteByKey: vi.fn<(labelKey: string) => Promise<LabelMapping[]>>(),
  };
  const handler = new LabelManageHandler(
    labelService as unknown as LabelService,
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
    labelService.findById.mockResolvedValue(MAPPING);
    labelService.findByKey.mockResolvedValue([MAPPING, OTHER]);
  });

  it('shows the values of the group with the current one marked', async () => {
    expect(await open(button(`lblmng:open:${MAPPING.id}`))).toEqual({
      screen: {
        text: [
          locale.labelManage.askValue(BOLD, 'for everyone', 'Priority', 'Low'),
          '',
          '**Critical** — Needed right now',
          '**High** — Needed soon',
          '**Medium** — As planned',
          '**Low** — When there is time',
        ].join('\n'),
        buttons: [
          [
            { text: 'Critical', data: `lblmng:set:${MAPPING.id}:0` },
            { text: 'High', data: `lblmng:set:${MAPPING.id}:1` },
          ],
          [
            { text: 'Medium', data: `lblmng:set:${MAPPING.id}:2` },
            { text: '✓ Low', data: `lblmng:set:${MAPPING.id}:3` },
          ],
          [{ text: 'Delete the value', data: `lblmng:del:${MAPPING.id}` }],
          [{ text: '‹ Back', data: `lbl:card:${MAPPING.id}:0` }],
        ],
      },
      dialog: null,
    });
  });

  it('changes the value', async () => {
    labelService.changeValue.mockResolvedValue({
      ...MAPPING,
      value: Priority.HIGH,
    });

    expect((await open(button(`lblmng:set:${MAPPING.id}:1`))).screen).toEqual({
      text: locale.labelManage.changed(BOLD, 'for everyone', 'Priority: High'),
      buttons: [[CARD], [LIST]],
    });
    expect(labelService.changeValue).toHaveBeenCalledWith(
      MAPPING.id,
      Priority.HIGH,
    );
  });

  it('does not write the value it already has', async () => {
    const { screen } = await open(button(`lblmng:set:${MAPPING.id}:3`));

    expect(labelService.changeValue).not.toHaveBeenCalled();
    expect(screen.text).toBe(
      locale.labelManage.changed(BOLD, 'for everyone', 'Priority: Low'),
    );
  });

  it('refuses a number beyond the group', async () => {
    expect((await open(button(`lblmng:set:${MAPPING.id}:4`))).screen).toEqual({
      text: locale.bot.expired,
    });
    expect(labelService.changeValue).not.toHaveBeenCalled();
  });

  it('deletes a value and opens what is left of the label', async () => {
    labelService.findByKey.mockResolvedValue([OTHER]);

    expect((await open(button(`lblmng:del:${MAPPING.id}`))).screen).toEqual({
      text: locale.labelManage.valueDeleted(
        BOLD,
        'for everyone',
        'Priority: Low',
      ),
      buttons: [
        [{ text: 'Open the card', data: `lbl:card:${OTHER.id}:0` }],
        [LIST],
      ],
    });
    expect(labelService.deleteById).toHaveBeenCalledWith(MAPPING.id);
  });

  it('says the label is gone with its last value', async () => {
    labelService.findByKey.mockResolvedValue([]);

    expect((await open(button(`lblmng:del:${MAPPING.id}`))).screen).toEqual({
      text: [
        locale.labelManage.valueDeleted(BOLD, 'for everyone', 'Priority: Low'),
        locale.labelManage.labelEmpty,
      ].join('\n\n'),
      buttons: [[LIST]],
    });
  });

  it('asks before deleting the whole label', async () => {
    expect((await open(button(`lblmng:drop:${MAPPING.id}`))).screen).toEqual({
      text: locale.labelManage.confirmDrop(BOLD, 2),
      buttons: [
        [
          { text: 'Yes, delete', data: `lblmng:dropok:${MAPPING.id}` },
          { text: 'Cancel', data: `lbl:card:${MAPPING.id}:0` },
        ],
      ],
    });
    expect(labelService.deleteByKey).not.toHaveBeenCalled();
  });

  it('deletes the label with all its values', async () => {
    expect((await open(button(`lblmng:dropok:${MAPPING.id}`))).screen).toEqual({
      text: locale.labelManage.dropped(BOLD),
      buttons: [[LIST]],
    });
    expect(labelService.deleteByKey).toHaveBeenCalledWith('status::easy');
  });

  it('says a deleted label is not found', async () => {
    labelService.findById.mockResolvedValue(null);

    expect((await open(button(`lblmng:open:${MAPPING.id}`))).screen).toEqual({
      text: locale.labelList.notFound,
      buttons: [[LIST]],
    });
  });

  it.each([
    'lblmng:open:not-an-id',
    `lblmng:set:${MAPPING.id}`,
    `lblmng:set:${MAPPING.id}:x`,
    `lblmng:other:${MAPPING.id}`,
  ])('answers the outdated button %s', async (data) => {
    expect((await open(button(data))).screen).toEqual({
      text: locale.bot.expired,
    });
  });
});
