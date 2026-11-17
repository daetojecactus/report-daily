import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatInput } from 'src/common/channel/types/chat-channel.interface';
import type { AiService } from 'src/modules/application/ai/ai.service';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { SettingsRepository } from 'src/modules/application/settings/settings.repository';
import { SettingsService } from 'src/modules/application/settings/settings.service';
import type { Settings } from 'src/modules/application/settings/types/settings.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AccessService } from '../../core/access.service';
import type { BotActor } from '../../core/types/bot.interface';
import { createEmployee } from '../../__test__/bot.fixture';
import { AdminHandler } from '../admin.handler';
import { AdminSettingsView } from '../settings/admin-settings.view';

const i18nService = new I18nService();
const locale = i18nService.getLocale(Language.EN);
const config = { get: () => 'Asia/Almaty' } as unknown as ConfigService<AppEnvs, true>;
const userService = {
  count: vi.fn<UserService['count']>(),
  countActive: vi.fn<UserService['countActive']>(),
};
const repository = { findOne: vi.fn<SettingsRepository['findOne']>() };
const aiService = { isEnabled: vi.fn<AiService['isEnabled']>() };
const handler = new AdminHandler(
  new AccessService(
    { get: () => [] } as unknown as ConfigService<AppEnvs, true>,
    {} as UserService,
    i18nService,
  ),
  userService as unknown as UserService,
  new SettingsService(repository as unknown as SettingsRepository),
  aiService as unknown as AiService,
  new AdminSettingsView(),
  config,
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
  beforeEach(() => {
    vi.resetAllMocks();
    userService.count.mockResolvedValue(30);
    userService.countActive.mockResolvedValue(4);
    repository.findOne.mockResolvedValue(null as unknown as Settings);
  });

  it('shows an owner the overview and every section', async () => {
    aiService.isEnabled.mockReturnValue(true);

    expect(await open(actor({ isOwner: true }), COMMAND)).toEqual({
      screen: {
        text: [
          '**Management**',
          'Employees: 30, 4 active',
          'Scheduled reports: on',
          'AI for everyone: yes',
        ].join('\n'),
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

  it('tells the owner when AI is not set up', async () => {
    aiService.isEnabled.mockReturnValue(false);

    expect((await open(actor({ isOwner: true }), COMMAND)).screen.text).toContain('AI: not set up');
  });

  it('shows an admin only the shared templates without the overview', async () => {
    const user = createEmployee({ isAdmin: true }).user;

    expect((await open(actor({ user }), button('adm:menu'))).screen).toEqual({
      text: '**Management**',
      buttons: [[{ text: 'Shared templates', data: 'tpls:list' }]],
    });
    expect(userService.count).not.toHaveBeenCalled();
  });

  it('says there is nothing for an employee who is not an admin', async () => {
    const user = createEmployee().user;

    expect((await open(actor({ user }), COMMAND)).screen).toEqual({
      text: [locale.admin.title, locale.admin.noSections].join('\n'),
      buttons: [],
    });
  });

  it.each(['adm:other', 'adm:menu:1'])('answers the outdated button %s', async (data) => {
    expect((await open(actor({ isOwner: true }), button(data))).screen).toEqual({
      text: locale.bot.expired,
    });
  });
});
