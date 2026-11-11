import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AccessService } from '../../core/access.service';
import type { BotActor } from '../../core/types/bot.interface';
import { createEmployee } from '../../__test__/bot.fixture';
import { AdminHandler } from '../admin.handler';

const i18nService = new I18nService();
const locale = i18nService.getLocale(Language.EN);
const handler = new AdminHandler(
  new AccessService(
    { get: () => [] } as unknown as ConfigService<AppEnvs, true>,
    {} as UserService,
    i18nService,
  ),
);

function actor(values: Partial<BotActor>): BotActor {
  return {
    channel: Channel.TELEGRAM,
    externalId: '1',
    chatId: '1',
    language: Language.EN,
    isOwner: false,
    user: null,
    ...values,
  };
}

function open(subject: BotActor, input: ChatInput) {
  return handler.handle({ actor: subject, locale, input, dialog: null });
}

const COMMAND: ChatInput = { type: ChatInputType.COMMAND, command: 'admin' };

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('AdminHandler', () => {
  it('shows an owner every section', () => {
    expect(open(actor({ isOwner: true }), COMMAND)).toEqual({
      screen: {
        text: locale.admin.title,
        buttons: [
          [{ text: 'Employees', data: 'emp:list:0' }],
          [{ text: 'Traits', data: 'trt:list:0' }],
          [{ text: 'Shared templates', data: 'tpls:list' }],
          [{ text: 'Settings', data: 'aset:menu' }],
          [{ text: 'Broadcast', data: 'bcast:start' }],
        ],
      },
      dialog: null,
    });
  });

  it('shows an admin only the shared templates', () => {
    const user = createEmployee({ isAdmin: true }).user;

    expect(open(actor({ user }), button('adm:menu')).screen.buttons).toEqual([
      [{ text: 'Shared templates', data: 'tpls:list' }],
    ]);
  });

  it('says there is nothing for an employee who is not an admin', () => {
    const user = createEmployee().user;

    expect(open(actor({ user }), COMMAND).screen).toEqual({
      text: [locale.admin.title, locale.admin.noSections].join('\n'),
      buttons: [],
    });
  });

  it.each(['adm:other', 'adm:menu:1'])('answers the outdated button %s', (data) => {
    expect(open(actor({ isOwner: true }), button(data)).screen).toEqual({
      text: locale.bot.expired,
    });
  });
});
