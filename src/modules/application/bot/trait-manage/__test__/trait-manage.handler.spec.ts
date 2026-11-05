import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { Source } from 'src/modules/application/source/source.enums';
import { TraitDimension, Priority, TaskFlag } from 'src/modules/application/trait/trait.enums';
import type { TraitMapping, TraitValue } from 'src/modules/application/trait/trait.interface';
import type { TraitService } from 'src/modules/application/trait/trait.service';
import { JobRole } from 'src/modules/application/user/user.enums';
import { TraitManageHandler } from '../trait-manage.handler';
import { TraitsView } from '../../traits/traits.view';

const locale = new I18nService().getLocale(Language.EN);
const BOLD = '**status::easy**';
const MAPPING: TraitMapping = {
  id: '019a4d2e-7c1b-7f3a-9c2d-000000000001',
  source: Source.GITLAB,
  sourceName: 'status::easy',
  sourceKey: 'status::easy',
  role: null,
  dimension: TraitDimension.PRIORITY,
  value: Priority.LOW,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const OTHER: TraitMapping = {
  ...MAPPING,
  id: '019a4d2e-7c1b-7f3a-9c2d-000000000002',
  role: JobRole.QA,
  dimension: TraitDimension.FLAG,
  value: TaskFlag.REGRESSION,
};
const CARD = { text: 'Open the card', data: `trt:card:${MAPPING.id}:0` };
const LIST = { text: 'To the list', data: 'trt:list:0' };

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('TraitManageHandler', () => {
  const traitService = {
    findById: vi.fn<(id: string) => Promise<TraitMapping | null>>(),
    findByKey: vi.fn<(source: Source, sourceKey: string) => Promise<TraitMapping[]>>(),
    changeValue: vi.fn<(id: string, value: TraitValue) => Promise<TraitMapping | null>>(),
    deleteById: vi.fn<(id: string) => Promise<TraitMapping | null>>(),
    deleteByKey: vi.fn<(source: Source, sourceKey: string) => Promise<TraitMapping[]>>(),
  };
  const handler = new TraitManageHandler(traitService as unknown as TraitService, new TraitsView());

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
    traitService.findById.mockResolvedValue(MAPPING);
    traitService.findByKey.mockResolvedValue([MAPPING, OTHER]);
  });

  it('shows the values of the group with the current one marked', async () => {
    expect(await open(button(`trtmng:open:${MAPPING.id}`))).toEqual({
      screen: {
        text: [
          locale.traitManage.askValue(BOLD, 'for everyone', 'Priority', 'Low'),
          '',
          '**Critical** — Needed right now',
          '**High** — Needed soon',
          '**Medium** — As planned',
          '**Low** — When there is time',
        ].join('\n'),
        buttons: [
          [
            { text: 'Critical', data: `trtmng:set:${MAPPING.id}:0` },
            { text: 'High', data: `trtmng:set:${MAPPING.id}:1` },
          ],
          [
            { text: 'Medium', data: `trtmng:set:${MAPPING.id}:2` },
            { text: '✓ Low', data: `trtmng:set:${MAPPING.id}:3` },
          ],
          [{ text: 'Delete the trait', data: `trtmng:del:${MAPPING.id}` }],
          [{ text: '‹ Back', data: `trt:card:${MAPPING.id}:0` }],
        ],
      },
      dialog: null,
    });
  });

  it('changes the value', async () => {
    traitService.changeValue.mockResolvedValue({
      ...MAPPING,
      value: Priority.HIGH,
    });

    expect((await open(button(`trtmng:set:${MAPPING.id}:1`))).screen).toEqual({
      text: locale.traitManage.changed(BOLD, 'for everyone', 'Priority: High'),
      buttons: [[CARD], [LIST]],
    });
    expect(traitService.changeValue).toHaveBeenCalledWith(MAPPING.id, Priority.HIGH);
  });

  it('does not write the value it already has', async () => {
    const { screen } = await open(button(`trtmng:set:${MAPPING.id}:3`));

    expect(traitService.changeValue).not.toHaveBeenCalled();
    expect(screen.text).toBe(locale.traitManage.changed(BOLD, 'for everyone', 'Priority: Low'));
  });

  it('refuses a number beyond the group', async () => {
    expect((await open(button(`trtmng:set:${MAPPING.id}:4`))).screen).toEqual({
      text: locale.bot.expired,
    });
    expect(traitService.changeValue).not.toHaveBeenCalled();
  });

  it('deletes a value and opens what is left of the label', async () => {
    traitService.findByKey.mockResolvedValue([OTHER]);

    expect((await open(button(`trtmng:del:${MAPPING.id}`))).screen).toEqual({
      text: locale.traitManage.valueDeleted(BOLD, 'for everyone', 'Priority: Low'),
      buttons: [[{ text: 'Open the card', data: `trt:card:${OTHER.id}:0` }], [LIST]],
    });
    expect(traitService.deleteById).toHaveBeenCalledWith(MAPPING.id);
  });

  it('says the label is gone with its last value', async () => {
    traitService.findByKey.mockResolvedValue([]);

    expect((await open(button(`trtmng:del:${MAPPING.id}`))).screen).toEqual({
      text: [
        locale.traitManage.valueDeleted(BOLD, 'for everyone', 'Priority: Low'),
        locale.traitManage.labelEmpty,
      ].join('\n\n'),
      buttons: [[LIST]],
    });
  });

  it('asks before deleting the whole label', async () => {
    expect((await open(button(`trtmng:drop:${MAPPING.id}`))).screen).toEqual({
      text: locale.traitManage.confirmDrop(BOLD, 2),
      buttons: [
        [
          { text: 'Yes, delete', data: `trtmng:dropok:${MAPPING.id}` },
          { text: 'Cancel', data: `trt:card:${MAPPING.id}:0` },
        ],
      ],
    });
    expect(traitService.deleteByKey).not.toHaveBeenCalled();
  });

  it('deletes the label with all its values', async () => {
    expect((await open(button(`trtmng:dropok:${MAPPING.id}`))).screen).toEqual({
      text: locale.traitManage.dropped(BOLD),
      buttons: [[LIST]],
    });
    expect(traitService.deleteByKey).toHaveBeenCalledWith(Source.GITLAB, 'status::easy');
  });

  it('says a deleted label is not found', async () => {
    traitService.findById.mockResolvedValue(null);

    expect((await open(button(`trtmng:open:${MAPPING.id}`))).screen).toEqual({
      text: locale.traitList.notFound,
      buttons: [[LIST]],
    });
  });

  it.each([
    'trtmng:open:not-an-id',
    `trtmng:set:${MAPPING.id}`,
    `trtmng:set:${MAPPING.id}:x`,
    `trtmng:other:${MAPPING.id}`,
  ])('answers the outdated button %s', async (data) => {
    expect((await open(button(data))).screen).toEqual({
      text: locale.bot.expired,
    });
  });
});
