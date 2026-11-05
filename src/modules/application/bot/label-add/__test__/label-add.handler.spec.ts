import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import {
  LabelDimension,
  Priority,
} from 'src/modules/application/label/label.enums';
import type {
  LabelMapping,
  LabelMappingInput,
} from 'src/modules/application/label/label.interface';
import type { LabelService } from 'src/modules/application/label/label.service';
import { JobRole } from 'src/modules/application/user/user.enums';
import type { BotDialog } from '../../bot.interface';
import { LabelAddHandler } from '../label-add.handler';

const locale = new I18nService().getLocale(Language.EN);
const LABEL = 'status::easy';
const BOLD = '**status::easy**';
const MAPPING: LabelMapping = {
  id: '019a4d2e-7c1b-7f3a-9c2d-000000000001',
  label: LABEL,
  labelKey: LABEL,
  role: null,
  dimension: LabelDimension.PRIORITY,
  value: Priority.LOW,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const CANCEL = { text: 'Cancel', data: 'lbladd:cancel' };
const CARD = { text: 'Open the card', data: `lbl:card:${MAPPING.id}:0` };
const LIST = { text: 'To the list', data: 'lbl:list:0' };

function dialog(step: string, data: Record<string, unknown>): BotDialog {
  return { namespace: 'lbladd', step, data };
}

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

function text(value: string): ChatInput {
  return { type: ChatInputType.TEXT, text: value };
}

describe('LabelAddHandler', () => {
  const labelService = {
    findByKey: vi.fn<(labelKey: string) => Promise<LabelMapping[]>>(),
    addValue:
      vi.fn<(input: LabelMappingInput) => Promise<LabelMapping | null>>(),
  };
  const handler = new LabelAddHandler(labelService as unknown as LabelService);

  function open(input: ChatInput, current: BotDialog | null = null) {
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
      dialog: current,
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    labelService.findByKey.mockResolvedValue([]);
  });

  it('asks for a label', async () => {
    expect(await open(button('lbladd:start'))).toEqual({
      screen: { text: locale.labelAdd.prompt, buttons: [[CANCEL]] },
      dialog: dialog('label', {}),
    });
  });

  it.each(['', '   ', '::', 'status::', '::easy', 'a'.repeat(256)])(
    'asks again for %j',
    async (value) => {
      expect(await open(text(value), dialog('label', {}))).toEqual({
        screen: { text: locale.labelAdd.invalid(255), buttons: [[CANCEL]] },
        dialog: dialog('label', {}),
      });
      expect(labelService.findByKey).not.toHaveBeenCalled();
    },
  );

  it('opens a label that is already set up', async () => {
    labelService.findByKey.mockResolvedValue([MAPPING]);

    expect(await open(text(' Status::Easy '), dialog('label', {}))).toEqual({
      screen: { text: locale.labelAdd.exists(BOLD), buttons: [[CARD], [LIST]] },
      dialog: null,
    });
    expect(labelService.findByKey).toHaveBeenCalledWith('status::easy');
  });

  it('asks who the value is for', async () => {
    expect(await open(text(LABEL), dialog('label', {}))).toEqual({
      screen: {
        text: locale.labelAdd.forWhom(BOLD),
        buttons: [
          [{ text: 'For everyone', data: 'lbladd:role:all' }],
          [
            { text: locale.roles.developer, data: 'lbladd:role:developer' },
            { text: locale.roles.qa, data: 'lbladd:role:qa' },
          ],
          [
            {
              text: locale.roles.project_manager,
              data: 'lbladd:role:project_manager',
            },
            {
              text: locale.roles.system_analyst,
              data: 'lbladd:role:system_analyst',
            },
          ],
          [{ text: locale.roles.devops, data: 'lbladd:role:devops' }],
          [CANCEL],
        ],
      },
      dialog: dialog('role', { label: LABEL }),
    });
  });

  it('asks for the group of the value', async () => {
    expect(
      await open(button('lbladd:role:qa'), dialog('role', { label: LABEL })),
    ).toEqual({
      screen: {
        text: locale.labelAdd.chooseDimension(BOLD, 'for the QA role'),
        buttons: [
          [
            { text: 'State', data: 'lbladd:dim:workflow_state' },
            { text: 'Task type', data: 'lbladd:dim:task_kind' },
          ],
          [
            { text: 'Priority', data: 'lbladd:dim:priority' },
            { text: 'Severity', data: 'lbladd:dim:severity' },
          ],
          [
            { text: 'Area', data: 'lbladd:dim:area' },
            { text: 'Flag', data: 'lbladd:dim:flag' },
          ],
          [CANCEL],
        ],
      },
      dialog: dialog('dim', { label: LABEL, role: JobRole.QA }),
    });
  });

  it('offers the values of the group with their descriptions', async () => {
    expect(
      await open(
        button('lbladd:dim:priority'),
        dialog('dim', { label: LABEL, role: null }),
      ),
    ).toEqual({
      screen: {
        text: [
          locale.labelAdd.chooseValue(BOLD, 'for everyone', 'Priority'),
          '',
          '**Critical** — Needed right now',
          '**High** — Needed soon',
          '**Medium** — As planned',
          '**Low** — When there is time',
        ].join('\n'),
        buttons: [
          [
            { text: 'Critical', data: 'lbladd:val:critical' },
            { text: 'High', data: 'lbladd:val:high' },
          ],
          [
            { text: 'Medium', data: 'lbladd:val:medium' },
            { text: 'Low', data: 'lbladd:val:low' },
          ],
          [{ text: '‹ Back', data: 'lbladd:dims' }, CANCEL],
        ],
      },
      dialog: dialog('val', {
        label: LABEL,
        role: null,
        dimension: LabelDimension.PRIORITY,
      }),
    });
  });

  it('goes back to the groups', async () => {
    const reply = await open(
      button('lbladd:dims'),
      dialog('val', {
        label: LABEL,
        role: null,
        dimension: LabelDimension.PRIORITY,
      }),
    );

    expect(reply.screen.text).toBe(
      locale.labelAdd.chooseDimension(BOLD, 'for everyone'),
    );
    expect(reply.dialog).toEqual(dialog('dim', { label: LABEL, role: null }));
  });

  it('maps the label to our value', async () => {
    labelService.addValue.mockResolvedValue(MAPPING);

    expect(
      await open(
        button('lbladd:val:low'),
        dialog('val', {
          label: LABEL,
          role: null,
          dimension: LabelDimension.PRIORITY,
        }),
      ),
    ).toEqual({
      screen: {
        text: locale.labelAdd.added(BOLD, 'for everyone', 'Priority: Low'),
        buttons: [
          [CARD],
          [{ text: 'Add another', data: 'lbladd:start' }],
          [LIST],
        ],
      },
      dialog: null,
    });
    expect(labelService.addValue).toHaveBeenCalledWith({
      label: LABEL,
      role: null,
      dimension: LabelDimension.PRIORITY,
      value: Priority.LOW,
    });
  });

  it('says the value is already set when the row exists', async () => {
    labelService.addValue.mockResolvedValue(null);
    labelService.findByKey.mockResolvedValue([MAPPING]);

    const { screen } = await open(
      button('lbladd:val:low'),
      dialog('val', {
        label: LABEL,
        role: null,
        dimension: LabelDimension.PRIORITY,
      }),
    );

    expect(screen).toEqual({
      text: locale.labelAdd.alreadySet(BOLD),
      buttons: [[CARD], [LIST]],
    });
  });

  it('refuses a value of another group', async () => {
    const reply = await open(
      button('lbladd:val:blocked'),
      dialog('val', {
        label: LABEL,
        role: null,
        dimension: LabelDimension.PRIORITY,
      }),
    );

    expect(reply.screen).toEqual({ text: locale.bot.expired });
    expect(labelService.addValue).not.toHaveBeenCalled();
  });

  it.each<[string, BotDialog | null]>([
    ['lbladd:role:all', null],
    ['lbladd:dim:priority', dialog('role', { label: LABEL })],
    ['lbladd:val:low', dialog('dim', { label: LABEL, role: null })],
    ['lbladd:dims', dialog('dim', { label: LABEL, role: null })],
  ])('answers %s without its step as outdated', async (data, current) => {
    expect((await open(button(data), current)).screen).toEqual({
      text: locale.bot.expired,
    });
  });

  it('cancels adding', async () => {
    expect(await open(button('lbladd:cancel'))).toEqual({
      screen: { text: locale.labelAdd.cancelled, buttons: [[LIST]] },
      dialog: null,
    });
  });

  it.each(['lbladd:role:boss', 'lbladd:dim:mood', 'lbladd:val', 'lbladd:x'])(
    'answers the outdated button %s',
    async (data) => {
      expect((await open(button(data))).screen).toEqual({
        text: locale.bot.expired,
      });
    },
  );
});
