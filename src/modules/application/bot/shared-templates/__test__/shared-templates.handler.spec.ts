import { Logger } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { ReportTemplate } from 'src/modules/application/report/template/template.interface';
import type { TemplateRepository } from 'src/modules/application/report/template/template.repository';
import { TemplateService } from 'src/modules/application/report/template/template.service';
import type { UserService } from 'src/modules/application/user/user.service';
import { SharedTemplatesHandler } from '../shared-templates.handler';

const locale = new I18nService().getLocale(Language.EN);

const SHARED: ReportTemplate = {
  id: '019a4d2e-7c1b-7f3a-9c2d-000000000001',
  name: 'QA *daily*',
  body: '{{ context.date }}',
  ownerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('SharedTemplatesHandler', () => {
  const repository = {
    find: vi.fn<TemplateRepository['find']>(),
    findOne: vi.fn<TemplateRepository['findOne']>(),
    deleteOne: vi.fn<TemplateRepository['deleteOne']>(),
  };
  const userService = { countByTemplate: vi.fn<UserService['countByTemplate']>() };
  const handler = new SharedTemplatesHandler(
    new TemplateService(repository as unknown as TemplateRepository),
    userService as unknown as UserService,
  );
  const open = (data: string) =>
    handler.handle({
      actor: {
        channel: Channel.TELEGRAM,
        externalId: '1',
        chatId: '1',
        language: Language.EN,
        isOwner: true,
        user: null,
      },
      locale,
      input: button(data),
      dialog: null,
    });

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    userService.countByTemplate.mockResolvedValue(3);
  });

  it('lists the shared templates with a way to create one', async () => {
    repository.find.mockResolvedValueOnce([SHARED] as never);

    expect(await open('tpls:list')).toEqual({
      screen: {
        text: [locale.sharedTemplates.title(1), locale.sharedTemplates.hint].join('\n'),
        buttons: [
          [{ text: 'QA *daily*', data: `tpls:card:${SHARED.id}` }],
          [
            { text: 'Create', data: 'tpladd:shared' },
            { text: 'Menu', data: 'adm:menu' },
          ],
        ],
      },
      dialog: null,
    });
    repository.find.mockResolvedValueOnce([] as never);
    expect((await open('tpls:list')).screen.text).toBe(
      [locale.sharedTemplates.title(0), locale.sharedTemplates.empty].join('\n'),
    );
  });

  it('shows a shared template with how many employees use it', async () => {
    repository.findOne.mockResolvedValue(SHARED);

    expect(await open(`tpls:card:${SHARED.id}`)).toEqual({
      screen: {
        text: [
          '**QA \\*daily\\***',
          locale.sharedTemplates.usedBy(3),
          '',
          '{{ context.date }}',
        ].join('\n'),
        buttons: [
          [{ text: 'Delete', data: `tpls:del:${SHARED.id}` }],
          [{ text: '‹ Shared templates', data: 'tpls:list' }],
        ],
      },
      dialog: null,
    });
    expect(userService.countByTemplate).toHaveBeenCalledWith(SHARED.id);
  });

  it('deletes a shared template after a confirmation that names how many use it', async () => {
    repository.findOne.mockResolvedValue(SHARED);
    repository.deleteOne.mockResolvedValue(SHARED);
    repository.find.mockResolvedValue([] as never);

    expect((await open(`tpls:del:${SHARED.id}`)).screen).toEqual({
      text: locale.sharedTemplates.confirmDelete('QA \\*daily\\*', 3),
      buttons: [
        [
          { text: 'Yes, delete', data: `tpls:delok:${SHARED.id}` },
          { text: 'Cancel', data: `tpls:card:${SHARED.id}` },
        ],
      ],
    });
    expect((await open(`tpls:delok:${SHARED.id}`)).screen.text).toContain(
      locale.templates.deleted('QA \\*daily\\*'),
    );
  });

  it('says a template is not found when it is gone or personal', async () => {
    repository.findOne.mockResolvedValue(null as unknown as ReportTemplate);
    repository.deleteOne.mockResolvedValue(null as unknown as ReportTemplate);
    repository.find.mockResolvedValue([] as never);

    expect((await open(`tpls:card:${SHARED.id}`)).screen.text).toContain(locale.templates.notFound);
    expect((await open(`tpls:delok:${SHARED.id}`)).screen.text).toContain(
      locale.templates.notFound,
    );
  });
});
