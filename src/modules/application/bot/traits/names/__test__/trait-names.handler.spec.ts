import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { Source } from 'src/modules/application/source/types/source.enums';
import type { TraitName } from 'src/modules/application/trait/trait-name/types/trait-name.interface';
import type { TraitNameService } from 'src/modules/application/trait/trait-name/trait-name.service';
import { TraitsView } from '../../traits.view';
import { TraitNamesHandler } from '../trait-names.handler';

const locale = new I18nService().getLocale(Language.EN);
const TRAITS = { text: 'To traits', data: 'trt:list:0' };

function name(index: number, values: Partial<TraitName> = {}): TraitName {
  return {
    id: `019a4d2e-7c1b-7f3a-9c2d-${String(index).padStart(12, '0')}`,
    source: Source.GITLAB,
    sourceName: `team::${index}`,
    sourceKey: `team::${index}`,
    ignored: false,
    seenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...values,
  };
}

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('TraitNamesHandler', () => {
  const traitNameService = {
    countUnmapped: vi.fn<(source: Source, ignored: boolean) => Promise<number>>(),
    findUnmappedPage:
      vi.fn<
        (source: Source, ignored: boolean, limit: number, offset: number) => Promise<TraitName[]>
      >(),
    findById: vi.fn<(id: string) => Promise<TraitName | null>>(),
    setIgnored: vi.fn<(id: string, ignored: boolean) => Promise<TraitName | null>>(),
  };
  const handler = new TraitNamesHandler(
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

  function count(unmapped: number, ignored: number) {
    traitNameService.countUnmapped.mockImplementation((_source, onlyIgnored) =>
      Promise.resolve(onlyIgnored ? ignored : unmapped),
    );
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lists the names without traits with a way to the ignored ones', async () => {
    count(10, 2);
    traitNameService.findUnmappedPage.mockResolvedValue([name(1), name(2)]);

    expect(await open(button('trtnm:list:new:0'))).toEqual({
      screen: {
        text: [
          locale.traitNames.title(10),
          locale.traitNames.hint(30),
          locale.traitList.page(1, 2),
        ].join('\n'),
        buttons: [
          [{ text: 'team::1', data: `trtnm:card:${name(1).id}:0` }],
          [{ text: 'team::2', data: `trtnm:card:${name(2).id}:0` }],
          [{ text: 'Next ›', data: 'trtnm:list:new:1' }],
          [{ text: 'Ignored · 2', data: 'trtnm:list:ign:0' }, TRAITS],
        ],
      },
      dialog: null,
    });
    expect(traitNameService.findUnmappedPage).toHaveBeenCalledWith(Source.GITLAB, false, 8, 0);
  });

  it('says there are no new names and hides the ignored list when it is empty', async () => {
    count(0, 0);
    traitNameService.findUnmappedPage.mockResolvedValue([]);

    expect(await open(button('trtnm:list:new:3'))).toEqual({
      screen: {
        text: [locale.traitNames.title(0), locale.traitNames.empty(30)].join('\n'),
        buttons: [[TRAITS]],
      },
      dialog: null,
    });
  });

  it('lists the ignored names on the last page with a way back', async () => {
    count(0, 9);
    traitNameService.findUnmappedPage.mockResolvedValue([name(9, { ignored: true })]);

    const { screen } = await open(button('trtnm:list:ign:4'));

    expect(traitNameService.findUnmappedPage).toHaveBeenCalledWith(Source.GITLAB, true, 8, 8);
    expect(screen.text).toBe(
      [
        locale.traitNames.ignoredTitle(9),
        locale.traitNames.ignoredHint,
        locale.traitList.page(2, 2),
      ].join('\n'),
    );
    expect(screen.buttons).toEqual([
      [{ text: 'team::9', data: `trtnm:card:${name(9).id}:1` }],
      [{ text: '‹ Back', data: 'trtnm:list:ign:0' }],
      [{ text: 'No traits', data: 'trtnm:list:new:0' }, TRAITS],
    ]);
  });

  it('opens a name without traits with the buttons to map and to ignore it', async () => {
    traitNameService.findById.mockResolvedValue(name(1));

    expect(await open(button(`trtnm:card:${name(1).id}:2`))).toEqual({
      screen: {
        text: ['**team::1**', locale.traitNames.card].join('\n'),
        buttons: [
          [
            { text: 'Map', data: `trtadd:name:${name(1).id}` },
            { text: 'Ignore', data: `trtnm:ign:${name(1).id}:2` },
          ],
          [{ text: '‹ Back', data: 'trtnm:list:new:2' }],
        ],
      },
      dialog: null,
    });
  });

  it('opens an ignored name with the button to count it again', async () => {
    traitNameService.findById.mockResolvedValue(name(1, { ignored: true }));

    const { screen } = await open(button(`trtnm:card:${name(1).id}:0`));

    expect(screen.text).toBe(['**team::1**', locale.traitNames.ignoredCard].join('\n'));
    expect(screen.buttons).toEqual([
      [
        { text: 'Map', data: `trtadd:name:${name(1).id}` },
        { text: 'Count again', data: `trtnm:rst:${name(1).id}:0` },
      ],
      [{ text: '‹ Back', data: 'trtnm:list:ign:0' }],
    ]);
  });

  it('ignores a name and goes back to the list with a notice', async () => {
    traitNameService.setIgnored.mockResolvedValue(name(1, { ignored: true }));
    count(4, 1);
    traitNameService.findUnmappedPage.mockResolvedValue([name(2)]);

    const { screen } = await open(button(`trtnm:ign:${name(1).id}:0`));

    expect(traitNameService.setIgnored).toHaveBeenCalledWith(name(1).id, true);
    expect(screen.text).toBe(
      [
        locale.traitNames.ignored('**team::1**'),
        '',
        locale.traitNames.title(4),
        locale.traitNames.hint(30),
      ].join('\n'),
    );
  });

  it('counts a name again and goes back to the ignored list', async () => {
    traitNameService.setIgnored.mockResolvedValue(name(1));
    count(5, 0);
    traitNameService.findUnmappedPage.mockResolvedValue([]);

    const { screen } = await open(button(`trtnm:rst:${name(1).id}:0`));

    expect(traitNameService.setIgnored).toHaveBeenCalledWith(name(1).id, false);
    expect(traitNameService.findUnmappedPage).toHaveBeenCalledWith(Source.GITLAB, true, 8, 0);
    expect(screen.text).toBe(
      [
        locale.traitNames.restored('**team::1**'),
        '',
        locale.traitNames.ignoredTitle(0),
        locale.traitNames.ignoredEmpty,
      ].join('\n'),
    );
  });

  it('says a name is not found', async () => {
    traitNameService.findById.mockResolvedValue(null);

    expect(await open(button(`trtnm:card:${name(1).id}:0`))).toEqual({
      screen: { text: locale.traitNames.notFound, buttons: [[TRAITS]] },
      dialog: null,
    });
  });

  it('does not take text or broken buttons', async () => {
    expect(await open({ type: ChatInputType.TEXT, text: 'team::1' })).toEqual({
      screen: { text: locale.bot.unknownInput },
    });
    expect(await open(button('trtnm:card:1:0'))).toEqual({
      screen: { text: locale.bot.expired },
    });
  });
});
