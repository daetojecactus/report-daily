import { Logger } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { Report } from 'src/modules/application/report/report.interface';
import type { ReportService } from 'src/modules/application/report/report.service';
import type {
  ReportContext,
  ReportTemplate,
} from 'src/modules/application/report/template/template.interface';
import type { TemplateRepository } from 'src/modules/application/report/template/template.repository';
import { TemplateService } from 'src/modules/application/report/template/template.service';
import type { ConfigService } from '@nestjs/config';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AccessService } from '../../access/access.service';
import type { BotActor, BotDialog } from '../../bot.interface';
import { createEmployee } from '../../__test__/bot.fixture';
import { Permission } from 'src/modules/application/user/user.enums';
import { TemplatesDraft } from '../../templates/templates.draft';
import { TemplateAddHandler } from '../template-add.handler';

const locale = new I18nService().getLocale(Language.EN);
const USER = createEmployee().user;
const BODY = '{% for project in context.projects %}{{ project.name }}{% endfor %}';
const NO_PREVIEW = [locale.templates.noPreview, '', locale.templates.previewHint].join('\n');
const SNAPSHOT = {
  projects: [{ name: 'api_core', url: null, items: [] }],
} as unknown as ReportContext;

function dialog(step: string, data: Record<string, unknown>): BotDialog {
  return { namespace: 'tpladd', step, data };
}

function text(value: string): ChatInput {
  return { type: ChatInputType.TEXT, text: value };
}

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('TemplateAddHandler', () => {
  const repository = { create: vi.fn<TemplateRepository['create']>() };
  const reportService = { findLatestSnapshot: vi.fn<ReportService['findLatestSnapshot']>() };
  const templateService = new TemplateService(repository as unknown as TemplateRepository);
  const handler = new TemplateAddHandler(
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
  });

  it('asks for a name, then for the text, and checks the name', async () => {
    expect(await open(button('tpladd:start'))).toEqual({
      screen: {
        text: locale.templates.askName(64),
        buttons: [[{ text: 'Cancel', data: 'tpladd:cancel' }]],
      },
      dialog: dialog('name', { shared: false }),
    });
    expect((await open(text('   '), dialog('name', { shared: false }))).screen.text).toContain(
      locale.templates.nameInvalid(64),
    );
    expect(await open(text(' QA daily '), dialog('name', { shared: false }))).toMatchObject({
      screen: { text: locale.templates.askBody('QA daily', 4000) },
      dialog: dialog('body', { shared: false, name: 'QA daily' }),
    });
  });

  it('shows a syntax error and asks for the text again', async () => {
    const reply = await open(
      text('{% for item in context.items %}'),
      dialog('body', { shared: false, name: 'QA' }),
    );

    expect(reply.screen.text).toContain('The template has an error:');
    expect(reply.dialog).toEqual(dialog('body', { shared: false, name: 'QA' }));
    expect(reportService.findLatestSnapshot).not.toHaveBeenCalled();
  });

  it('previews the text on the latest saved report and keeps it for saving', async () => {
    reportService.findLatestSnapshot.mockResolvedValue({
      reportDate: '2026-11-06',
      snapshot: SNAPSHOT,
    } as Report);

    expect(await open(text(BODY), dialog('body', { shared: false, name: 'QA' }))).toEqual({
      screen: {
        text: [
          locale.templates.preview('6 November'),
          '',
          'api\\_core',
          '',
          locale.templates.previewHint,
        ].join('\n'),
        buttons: [
          [
            { text: 'Save', data: 'tpladd:save' },
            { text: 'Edit text', data: 'tpladd:text' },
          ],
          [{ text: 'Cancel', data: 'tpladd:cancel' }],
        ],
      },
      dialog: dialog('preview', { shared: false, name: 'QA', body: BODY }),
    });
  });

  it('goes back to the text from the preview and checks a new text sent on the preview', async () => {
    const preview = dialog('preview', { shared: false, name: 'QA', body: BODY });

    expect(await open(button('tpladd:text'), preview)).toEqual({
      screen: {
        text: locale.templates.askBody('QA', 4000),
        buttons: [[{ text: 'Cancel', data: 'tpladd:cancel' }]],
      },
      dialog: dialog('body', { shared: false, name: 'QA' }),
    });
    expect(await open(text(' {{ context.date }} '), preview)).toMatchObject({
      screen: { text: NO_PREVIEW },
      dialog: dialog('preview', { shared: false, name: 'QA', body: '{{ context.date }}' }),
    });
    expect((await open(text('{% if %}'), preview)).dialog).toEqual(
      dialog('body', { shared: false, name: 'QA' }),
    );
    expect(
      await open(button('tpladd:text'), dialog('body', { shared: false, name: 'QA' })),
    ).toEqual({ screen: { text: locale.bot.expired }, dialog: null });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('says there is no preview without a saved report', async () => {
    reportService.findLatestSnapshot.mockResolvedValue(null as unknown as Report);

    expect(
      (await open(text(BODY), dialog('body', { shared: false, name: 'QA' }))).screen.text,
    ).toBe(NO_PREVIEW);
  });

  it('saves the template of the employee and offers to use it', async () => {
    repository.create.mockResolvedValue({
      id: '019a4d2e-7c1b-7f3a-9c2d-000000000007',
      name: 'QA',
    } as ReportTemplate);

    expect(
      await open(
        button('tpladd:save'),
        dialog('preview', { shared: false, name: 'QA', body: BODY }),
      ),
    ).toEqual({
      screen: {
        text: locale.templates.saved('QA'),
        buttons: [
          [
            { text: 'Use', data: 'tpl:use:019a4d2e-7c1b-7f3a-9c2d-000000000007' },
            { text: '‹ My templates', data: 'tpl:mine' },
          ],
        ],
      },
      dialog: null,
    });
    expect(repository.create).toHaveBeenCalledWith({ name: 'QA', body: BODY, ownerId: USER.id });
  });

  it('does not save without a previewed text and cancels on request', async () => {
    expect(
      await open(button('tpladd:save'), dialog('body', { shared: false, name: 'QA' })),
    ).toEqual({
      screen: { text: locale.bot.expired },
      dialog: null,
    });
    expect(repository.create).not.toHaveBeenCalled();
    expect(await open(button('tpladd:cancel'))).toEqual({
      screen: {
        text: locale.templates.cancelled,
        buttons: [[{ text: '‹ My templates', data: 'tpl:mine' }]],
      },
      dialog: null,
    });
  });

  it('makes a shared template for the owner without an employee record', async () => {
    const owner = { isOwner: true, user: null };
    repository.create.mockResolvedValue({
      id: '019a4d2e-7c1b-7f3a-9c2d-000000000008',
      name: 'QA',
    } as ReportTemplate);

    expect((await open(button('tpladd:shared'), null, owner)).dialog).toEqual(
      dialog('name', { shared: true }),
    );
    expect(
      (await open(text(BODY), dialog('body', { shared: true, name: 'QA' }), owner)).screen.text,
    ).toBe(NO_PREVIEW);
    expect(reportService.findLatestSnapshot).not.toHaveBeenCalled();
    expect(
      await open(
        button('tpladd:save'),
        dialog('preview', { shared: true, name: 'QA', body: BODY }),
        owner,
      ),
    ).toEqual({
      screen: {
        text: locale.sharedTemplates.saved('QA'),
        buttons: [[{ text: '‹ Shared templates', data: 'tpls:list' }]],
      },
      dialog: null,
    });
    expect(repository.create).toHaveBeenCalledWith({ name: 'QA', body: BODY, ownerId: null });
  });

  it('lets only the owner and the templates permission make shared templates', async () => {
    expect(await open(button('tpladd:shared'))).toEqual({
      screen: { text: locale.bot.forbidden },
      dialog: null,
    });
    expect(
      await open(
        button('tpladd:save'),
        dialog('preview', { shared: true, name: 'QA', body: BODY }),
      ),
    ).toEqual({ screen: { text: locale.bot.forbidden }, dialog: null });
    expect(
      (
        await open(button('tpladd:shared'), null, {
          user: { ...USER, permissions: [Permission.TEMPLATES] },
        })
      ).dialog,
    ).toEqual(dialog('name', { shared: true }));
    expect(await open(button('tpladd:start'), null, { isOwner: true, user: null })).toEqual({
      screen: { text: locale.bot.forbidden },
      dialog: null,
    });
    expect(repository.create).not.toHaveBeenCalled();
  });
});
