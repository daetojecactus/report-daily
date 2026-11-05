import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { Permission } from 'src/modules/application/user/user.enums';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AccessService } from '../../access/access.service';
import type { BotActor } from '../../bot.interface';
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
        ],
      },
      dialog: null,
    });
  });

  it('shows the employees section to an admin with the users permission', () => {
    const user = createEmployee({ permissions: [Permission.USERS] }).user;

    expect(open(actor({ user }), button('adm:menu')).screen.buttons).toEqual([
      [{ text: 'Employees', data: 'emp:list:0' }],
    ]);
  });

  it('shows the labels section to an admin with the labels permission', () => {
    const user = createEmployee({ permissions: [Permission.TRAITS] }).user;

    expect(open(actor({ user }), COMMAND).screen.buttons).toEqual([
      [{ text: 'Traits', data: 'trt:list:0' }],
    ]);
  });

  it('says there is nothing yet for other permissions', () => {
    const user = createEmployee({ permissions: [Permission.BROADCAST] }).user;

    expect(open(actor({ user }), COMMAND).screen).toEqual({
      text: [locale.admin.title, locale.admin.noSections].join('\n'),
      buttons: [],
    });
  });

  it.each(['adm:other', 'adm:menu:1'])(
    'answers the outdated button %s',
    (data) => {
      expect(open(actor({ isOwner: true }), button(data)).screen).toEqual({
        text: locale.bot.expired,
      });
    },
  );
});
