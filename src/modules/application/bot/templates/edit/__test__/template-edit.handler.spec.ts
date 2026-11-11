import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { Report } from 'src/modules/application/report/types/report.interface';
import type { ReportService } from 'src/modules/application/report/report.service';
import type { ReportTemplate } from 'src/modules/application/report/template/types/template.interface';
import type { TemplateRepository } from 'src/modules/application/report/template/template.repository';
import { TemplateService } from 'src/modules/application/report/template/template.service';
import { Permission } from 'src/modules/application/user/types/user.enums';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AccessService } from '../../../core/access.service';
import type { BotActor, BotDialog } from '../../../core/types/bot.interface';
import { createEmployee } from '../../../__test__/bot.fixture';
import { TemplatesDraft } from '../../templates.draft';
import { TemplateEditHandler } from '../template-edit.handler';

const locale = new I18nService().getLocale(Language.EN);
const USER = createEmployee().user;
const BODY = '{% for item in context.items %}{{ item.text }}{% endfor %}';
const NO_PREVIEW = [locale.templates.noPreview, '', locale.templates.previewHint].join('\n');

function template(values: Partial<ReportTemplate> = {}): ReportTemplate {
  return {
    id: '019a4d2e-7c1b-7f3a-9c2d-000000000002',
    name: 'Mine',
    body: '{{ context.date }}',
    ownerId: USER.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...values,
  };
}

const OWN = template();
const SHARED = template({ id: '019a4d2e-7c1b-7f3a-9c2d-000000000001', ownerId: null });

function dialog(step: string, data: Record<string, unknown>): BotDialog {
  return { namespace: 'tpledit', step, data };
}

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

function text(value: string): ChatInput {
  return { type: ChatInputType.TEXT, text: value };
}

describe('TemplateEditHandler', () => {
  const repository = {
    findOne: vi.fn<TemplateRepository['findOne']>(),
    updateOne: vi.fn<TemplateRepository['updateOne']>(),
  };
  const reportService = { findLatestSnapshot: vi.fn<ReportService['findLatestSnapshot']>() };
  const templateService = new TemplateService(repository as unknown as TemplateRepository);
  const handler = new TemplateEditHandler(
    templateService,
    new TemplatesDraft(templateService, reportService as unknown as ReportService),
    new AccessService(
      { get: () => [] } as unknown as ConfigService<AppEnvs, true>,
      {} as UserService,
      new I18nService(),
    ),
  );
  const open = (
    input: ChatInput,
    current: BotDialog | null = null,
    actor: Partial<BotActor> = {},
  ) =>
    handler.handle({
      actor: {
        channel: Channel.TELEGRAM,
        externalId: '1',
        chatId: '1',
        language: Language.EN,
        isOwner: false,
        user: USER,
        ...actor,
      },
      locale,
      input,
      dialog: current,
    });

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    reportService.findLatestSnapshot.mockResolvedValue(null as unknown as Report);
  });

  it('renames an own template and goes back to its card', async () => {
    repository.findOne.mockResolvedValue(OWN);

    expect(await open(button(`tpledit:name:${OWN.id}`))).toEqual({
      screen: {
        text: locale.templates.askNewName('Mine', 64),
        buttons: [[{ text: 'Cancel', data: 'tpledit:cancel' }]],
      },
      dialog: dialog('name', { templateId: OWN.id }),
    });
    expect((await open(text(' '), dialog('name', { templateId: OWN.id }))).screen.text).toContain(
      locale.templates.nameInvalid(64),
    );
    expect(await open(text(' Daily '), dialog('name', { templateId: OWN.id }))).toEqual({
      screen: {
        text: locale.templates.renamed('Daily'),
        buttons: [[{ text: '‹ To the template', data: `tpl:card:${OWN.id}` }]],
      },
      dialog: null,
    });
    expect(repository.updateOne).toHaveBeenCalledWith(expect.anything(), { name: 'Daily' });
  });

  it('replaces the text after the check and the preview', async () => {
    repository.findOne.mockResolvedValue(OWN);

    expect((await open(button(`tpledit:text:${OWN.id}`))).dialog).toEqual(
      dialog('body', { templateId: OWN.id }),
    );
    expect(
      (await open(text('{% if %}'), dialog('body', { templateId: OWN.id }))).screen.text,
    ).toContain('The template has an error:');
    expect(await open(text(BODY), dialog('body', { templateId: OWN.id }))).toEqual({
      screen: {
        text: NO_PREVIEW,
        buttons: [
          [
            { text: 'Save', data: 'tpledit:save' },
            { text: 'Edit text', data: `tpledit:text:${OWN.id}` },
          ],
          [{ text: 'Cancel', data: 'tpledit:cancel' }],
        ],
      },
      dialog: dialog('preview', { templateId: OWN.id, body: BODY }),
    });
    expect(
      (
        await open(
          text('{{ context.date }}'),
          dialog('preview', { templateId: OWN.id, body: BODY }),
        )
      ).dialog,
    ).toEqual(dialog('preview', { templateId: OWN.id, body: '{{ context.date }}' }));
    expect(
      await open(button('tpledit:save'), dialog('preview', { templateId: OWN.id, body: BODY })),
    ).toEqual({
      screen: {
        text: locale.templates.bodyReplaced('Mine'),
        buttons: [[{ text: '‹ To the template', data: `tpl:card:${OWN.id}` }]],
      },
      dialog: null,
    });
    expect(repository.updateOne).toHaveBeenCalledWith(expect.anything(), { body: BODY });
  });

  it('lets the templates permission change a shared template and returns to the shared card', async () => {
    repository.findOne.mockResolvedValue(SHARED);
    const admin = { user: { ...USER, permissions: [Permission.TEMPLATES] } };

    expect(await open(text('QA'), dialog('name', { templateId: SHARED.id }), admin)).toMatchObject({
      screen: { buttons: [[{ text: '‹ To the template', data: `tpls:card:${SHARED.id}` }]] },
    });
    expect(
      (await open(button(`tpledit:text:${SHARED.id}`), null, { isOwner: true, user: null })).dialog,
    ).toEqual(dialog('body', { templateId: SHARED.id }));
  });

  it('refuses a template of someone else and a shared one without the permission', async () => {
    repository.findOne.mockResolvedValueOnce(template({ ownerId: 'someone-else' }));
    repository.findOne.mockResolvedValueOnce(SHARED);

    for (const id of [OWN.id, SHARED.id]) {
      expect(await open(button(`tpledit:name:${id}`))).toEqual({
        screen: { text: locale.templates.notFound },
        dialog: null,
      });
    }
    expect(repository.updateOne).not.toHaveBeenCalled();
  });

  it('cancels a change and expires a save without a preview', async () => {
    repository.findOne.mockResolvedValue(OWN);

    expect(
      (await open(button('tpledit:cancel'), dialog('body', { templateId: OWN.id }))).screen.text,
    ).toBe(locale.templates.editCancelled);
    expect(await open(button('tpledit:save'), dialog('body', { templateId: OWN.id }))).toEqual({
      screen: { text: locale.bot.expired },
      dialog: null,
    });
    expect(repository.updateOne).not.toHaveBeenCalled();
  });
});
