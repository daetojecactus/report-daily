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
import type { BotDialog } from '../../bot.interface';
import { createEmployee } from '../../__test__/bot.fixture';
import { TemplateAddHandler } from '../template-add.handler';

const locale = new I18nService().getLocale(Language.EN);
const USER = createEmployee().user;
const BODY = '{% for project in context.projects %}{{ project.name }}{% endfor %}';
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
  const handler = new TemplateAddHandler(
    new TemplateService(repository as unknown as TemplateRepository),
    reportService as unknown as ReportService,
  );
  const open = (input: ChatInput, current: BotDialog | null = null) =>
    handler.handle({
      actor: {
        channel: Channel.TELEGRAM,
        externalId: '1',
        chatId: '1',
        language: Language.EN,
        isOwner: false,
        user: USER,
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
      dialog: dialog('name', {}),
    });
    expect((await open(text('   '), dialog('name', {}))).screen.text).toContain(
      locale.templates.nameInvalid(64),
    );
    expect(await open(text(' QA daily '), dialog('name', {}))).toMatchObject({
      screen: { text: locale.templates.askBody('QA daily', 4000) },
      dialog: dialog('body', { name: 'QA daily' }),
    });
  });

  it('shows a syntax error and asks for the text again', async () => {
    const reply = await open(
      text('{% for item in context.items %}'),
      dialog('body', { name: 'QA' }),
    );

    expect(reply.screen.text).toContain('The template has an error:');
    expect(reply.dialog).toEqual(dialog('body', { name: 'QA' }));
    expect(reportService.findLatestSnapshot).not.toHaveBeenCalled();
  });

  it('previews the text on the latest saved report and keeps it for saving', async () => {
    reportService.findLatestSnapshot.mockResolvedValue({
      reportDate: '2026-11-06',
      snapshot: SNAPSHOT,
    } as Report);

    expect(await open(text(BODY), dialog('body', { name: 'QA' }))).toEqual({
      screen: {
        text: [locale.templates.preview('6 November'), '', 'api\\_core'].join('\n'),
        buttons: [
          [
            { text: 'Save', data: 'tpladd:save' },
            { text: 'Cancel', data: 'tpladd:cancel' },
          ],
        ],
      },
      dialog: dialog('preview', { name: 'QA', body: BODY }),
    });
  });

  it('says there is no preview without a saved report', async () => {
    reportService.findLatestSnapshot.mockResolvedValue(null as unknown as Report);

    expect((await open(text(BODY), dialog('body', { name: 'QA' }))).screen.text).toBe(
      locale.templates.noPreview,
    );
  });

  it('saves the template of the employee and offers to use it', async () => {
    repository.create.mockResolvedValue({
      id: '019a4d2e-7c1b-7f3a-9c2d-000000000007',
      name: 'QA',
    } as ReportTemplate);

    expect(
      await open(button('tpladd:save'), dialog('preview', { name: 'QA', body: BODY })),
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
    expect(await open(button('tpladd:save'), dialog('body', { name: 'QA' }))).toEqual({
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
});
