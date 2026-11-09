import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { ReportTemplate } from 'src/modules/application/report/template/template.interface';
import { TemplateService } from 'src/modules/application/report/template/template.service';
import type { TemplateRepository } from 'src/modules/application/report/template/template.repository';
import type { User } from 'src/modules/application/user/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import { createEmployee } from '../../__test__/bot.fixture';
import { TemplatesHandler } from '../templates.handler';

const locale = new I18nService().getLocale(Language.EN);
const USER = createEmployee().user;

function template(index: number, values: Partial<ReportTemplate> = {}): ReportTemplate {
  return {
    id: `019a4d2e-7c1b-7f3a-9c2d-${String(index).padStart(12, '0')}`,
    name: `Template ${index}`,
    body: '{{ context.date }}',
    ownerId: USER.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...values,
  };
}

const SHARED = template(1, { name: 'QA', ownerId: null });
const OWN = template(2, { name: 'Mine *short*' });
const FOREIGN = template(3, { ownerId: '0190b5a8-0000-7000-8000-000000000099' });

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('TemplatesHandler', () => {
  const repository = {
    find: vi.fn<TemplateRepository['find']>(),
    findOne: vi.fn<TemplateRepository['findOne']>(),
    deleteOne: vi.fn<TemplateRepository['deleteOne']>(),
  };
  const userService = { updateSettings: vi.fn<UserService['updateSettings']>() };
  const handler = new TemplatesHandler(
    new TemplateService(repository as unknown as TemplateRepository),
    userService as unknown as UserService,
  );
  const open = (data: string, user: User = USER) =>
    handler.handle({
      actor: {
        channel: Channel.TELEGRAM,
        externalId: '1',
        chatId: '1',
        language: Language.EN,
        isOwner: false,
        user,
      },
      locale,
      input: button(data),
      dialog: null,
    });

  beforeEach(() => {
    vi.resetAllMocks();
    repository.find.mockResolvedValue([SHARED, OWN] as never);
  });

  it('offers Standard, the shared and the own templates with a mark on the current one', async () => {
    expect(await open('tpl:menu', { ...USER, templateId: OWN.id })).toEqual({
      screen: {
        text: [locale.templates.title, locale.templates.current('Mine \\*short\\*')].join('\n'),
        buttons: [
          [{ text: 'Standard', data: 'tpl:use:std' }],
          [{ text: 'QA (shared)', data: `tpl:use:${SHARED.id}` }],
          [{ text: '✓ Mine *short*', data: `tpl:use:${OWN.id}` }],
          [
            { text: 'My templates', data: 'tpl:mine' },
            { text: '‹ Settings', data: 'set:menu' },
          ],
        ],
      },
      dialog: null,
    });
    expect((await open('tpl:menu')).screen.buttons?.[0]).toEqual([
      { text: '✓ Standard', data: 'tpl:use:std' },
    ]);
  });

  it('picks a shared template and goes back to Standard', async () => {
    repository.findOne.mockResolvedValue(SHARED);
    userService.updateSettings.mockResolvedValueOnce({ ...USER, templateId: SHARED.id });

    const picked = await open(`tpl:use:${SHARED.id}`);
    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, { templateId: SHARED.id });
    expect(picked.screen.text).toContain(locale.templates.chosen('QA (shared)'));

    userService.updateSettings.mockResolvedValueOnce(USER);
    await open('tpl:use:std', { ...USER, templateId: SHARED.id });
    expect(userService.updateSettings).toHaveBeenLastCalledWith(USER.id, { templateId: null });
  });

  it('refuses a template of another employee', async () => {
    repository.findOne.mockResolvedValue(FOREIGN);

    expect((await open(`tpl:use:${FOREIGN.id}`)).screen.text).toContain(locale.templates.notFound);
    expect(userService.updateSettings).not.toHaveBeenCalled();
  });

  it('lists the own templates with a way to create one', async () => {
    repository.find.mockResolvedValueOnce([OWN] as never);

    expect(await open('tpl:mine')).toEqual({
      screen: {
        text: locale.templates.mineTitle(1),
        buttons: [
          [{ text: 'Mine *short*', data: `tpl:card:${OWN.id}` }],
          [
            { text: 'Create', data: 'tpladd:start' },
            { text: '‹ Back', data: 'tpl:menu' },
          ],
        ],
      },
      dialog: null,
    });
    repository.find.mockResolvedValueOnce([] as never);
    expect((await open('tpl:mine')).screen.text).toBe(
      [locale.templates.mineTitle(0), locale.templates.mineEmpty].join('\n'),
    );
  });

  it('shows an own template and deletes it after a confirmation', async () => {
    repository.findOne.mockResolvedValue(OWN);
    repository.deleteOne.mockResolvedValue(OWN);
    repository.find.mockResolvedValue([] as never);

    expect(await open(`tpl:card:${OWN.id}`)).toEqual({
      screen: {
        text: ['**Mine \\*short\\***', '', '{{ context.date }}'].join('\n'),
        buttons: [
          [
            { text: 'Use', data: `tpl:use:${OWN.id}` },
            { text: 'Delete', data: `tpl:del:${OWN.id}` },
          ],
          [{ text: '‹ My templates', data: 'tpl:mine' }],
        ],
      },
      dialog: null,
    });
    expect((await open(`tpl:del:${OWN.id}`)).screen.buttons).toEqual([
      [
        { text: 'Yes, delete', data: `tpl:delok:${OWN.id}` },
        { text: 'Cancel', data: `tpl:card:${OWN.id}` },
      ],
    ]);
    expect((await open(`tpl:delok:${OWN.id}`)).screen.text).toContain(
      locale.templates.deleted('Mine \\*short\\*'),
    );
  });

  it('does not show or delete a template of another employee', async () => {
    repository.findOne.mockResolvedValue(FOREIGN);
    repository.deleteOne.mockResolvedValue(null as unknown as ReportTemplate);

    expect((await open(`tpl:card:${FOREIGN.id}`)).screen.text).toContain(locale.templates.notFound);
    expect((await open(`tpl:delok:${FOREIGN.id}`)).screen.text).toContain(
      locale.templates.notFound,
    );
  });
});
