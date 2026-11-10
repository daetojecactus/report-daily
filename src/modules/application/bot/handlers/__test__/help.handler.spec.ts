import { describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { BotActor } from '../../bot.interface';
import { createEmployee } from '../../__test__/bot.fixture';
import type { MenuService } from '../../menu/menu.service';
import { HelpHandler } from '../help.handler';

const locale = new I18nService().getLocale(Language.EN);

function actor(values: Partial<BotActor>): BotActor {
  return {
    channel: Channel.SLACK,
    externalId: 'U0EMPLOY1',
    chatId: 'D100',
    language: Language.EN,
    isOwner: false,
    user: createEmployee().user,
    ...values,
  };
}

describe('HelpHandler', () => {
  const menuService = { listCommands: vi.fn<MenuService['listCommands']>() };
  const handler = new HelpHandler(menuService as unknown as MenuService);
  const open = (who: BotActor) =>
    handler.handle({
      actor: who,
      locale,
      input: { type: ChatInputType.COMMAND, command: 'help' },
      dialog: null,
    });

  it('lists the commands with buttons for the sections the person can open', () => {
    menuService.listCommands.mockReturnValue(
      ['start', 'report', 'settings', 'admin', 'help'].map((command) => ({
        command,
        description: command,
      })),
    );

    expect(open(actor({ isOwner: true })).screen.buttons).toEqual([
      [
        { text: 'Report', data: 'rpt:menu' },
        { text: 'Settings', data: 'set:menu' },
        { text: 'Admin', data: 'adm:menu' },
      ],
    ]);
  });

  it('shows no buttons when there is no section to open', () => {
    menuService.listCommands.mockReturnValue([{ command: 'start', description: 'start' }]);

    expect(open(actor({ user: null })).screen).toEqual({
      text: [locale.help.title, '/start — start'].join('\n'),
    });
  });
});
