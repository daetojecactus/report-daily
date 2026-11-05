import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { Source } from 'src/modules/application/source/source.enums';
import { TraitDimension, Priority } from 'src/modules/application/trait/trait.enums';
import type {
  TraitMapping,
  TraitMappingInput,
} from 'src/modules/application/trait/trait.interface';
import type { TraitService } from 'src/modules/application/trait/trait.service';
import { JobRole } from 'src/modules/application/user/user.enums';
import type { BotDialog } from '../../bot.interface';
import { TraitAddHandler } from '../trait-add.handler';
import { TraitsView } from '../../traits/traits.view';

const locale = new I18nService().getLocale(Language.EN);
const LABEL = 'status::easy';
const BOLD = '**status::easy**';
const MAPPING: TraitMapping = {
  id: '019a4d2e-7c1b-7f3a-9c2d-000000000001',
  source: Source.GITLAB,
  sourceName: LABEL,
  sourceKey: LABEL,
  role: null,
  dimension: TraitDimension.PRIORITY,
  value: Priority.LOW,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const CANCEL = { text: 'Cancel', data: 'trtadd:cancel' };
const CARD = { text: 'Open the card', data: `trt:card:${MAPPING.id}:0` };
const LIST = { text: 'To the list', data: 'trt:list:0' };

function dialog(step: string, data: Record<string, unknown>): BotDialog {
  return { namespace: 'trtadd', step, data };
}

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

function text(value: string): ChatInput {
  return { type: ChatInputType.TEXT, text: value };
}

describe('TraitAddHandler', () => {
  const traitService = {
    findById: vi.fn<(id: string) => Promise<TraitMapping | null>>(),
    findByKey: vi.fn<(source: Source, sourceKey: string) => Promise<TraitMapping[]>>(),
    addValue: vi.fn<(input: TraitMappingInput) => Promise<TraitMapping | null>>(),
  };
  const handler = new TraitAddHandler(traitService as unknown as TraitService, new TraitsView());

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
    traitService.findByKey.mockResolvedValue([]);
  });

  it('asks for a label', async () => {
    expect(await open(button('trtadd:start'))).toEqual({
      screen: { text: locale.traitAdd.prompt, buttons: [[CANCEL]] },
      dialog: dialog('label', {}),
    });
  });

  it.each(['', '   ', '::', 'status::', '::easy', 'a'.repeat(256)])(
    'asks again for %j',
    async (value) => {
      expect(await open(text(value), dialog('label', {}))).toEqual({
        screen: { text: locale.traitAdd.invalid(255), buttons: [[CANCEL]] },
        dialog: dialog('label', {}),
      });
      expect(traitService.findByKey).not.toHaveBeenCalled();
    },
  );

  it('opens a label that is already set up', async () => {
    traitService.findByKey.mockResolvedValue([MAPPING]);

    expect(await open(text(' Status::Easy '), dialog('label', {}))).toEqual({
      screen: { text: locale.traitAdd.exists(BOLD), buttons: [[CARD], [LIST]] },
      dialog: null,
    });
    expect(traitService.findByKey).toHaveBeenCalledWith(Source.GITLAB, 'status::easy');
  });

  it('asks who the value is for', async () => {
    expect(await open(text(LABEL), dialog('label', {}))).toEqual({
      screen: {
        text: locale.traitAdd.forWhom(BOLD),
        buttons: [
          [{ text: 'For everyone', data: 'trtadd:role:all' }],
          [
            { text: locale.roles.developer, data: 'trtadd:role:developer' },
            { text: locale.roles.qa, data: 'trtadd:role:qa' },
          ],
          [
            {
              text: locale.roles.project_manager,
              data: 'trtadd:role:project_manager',
            },
            {
              text: locale.roles.system_analyst,
              data: 'trtadd:role:system_analyst',
            },
          ],
          [{ text: locale.roles.devops, data: 'trtadd:role:devops' }],
          [CANCEL],
        ],
      },
      dialog: dialog('role', { label: LABEL }),
    });
  });

  it('adds a value to a label that is already set up', async () => {
    traitService.findById.mockResolvedValue(MAPPING);

    const reply = await open(button(`trtadd:more:${MAPPING.id}`));

    expect(reply.screen.text).toBe(locale.traitAdd.forWhom(BOLD));
    expect(reply.dialog).toEqual(dialog('role', { label: LABEL }));
    expect(traitService.findByKey).not.toHaveBeenCalled();
  });

  it('says a deleted label is not found when adding a value', async () => {
    traitService.findById.mockResolvedValue(null);

    expect(await open(button(`trtadd:more:${MAPPING.id}`))).toEqual({
      screen: { text: locale.traitList.notFound, buttons: [[LIST]] },
      dialog: null,
    });
  });

  it('asks for the group of the value', async () => {
    expect(await open(button('trtadd:role:qa'), dialog('role', { label: LABEL }))).toEqual({
      screen: {
        text: locale.traitAdd.chooseDimension(BOLD, 'for the QA role'),
        buttons: [
          [
            { text: 'State', data: 'trtadd:dim:workflow_state' },
            { text: 'Task type', data: 'trtadd:dim:task_kind' },
          ],
          [
            { text: 'Priority', data: 'trtadd:dim:priority' },
            { text: 'Severity', data: 'trtadd:dim:severity' },
          ],
          [
            { text: 'Area', data: 'trtadd:dim:area' },
            { text: 'Flag', data: 'trtadd:dim:flag' },
          ],
          [CANCEL],
        ],
      },
      dialog: dialog('dim', { label: LABEL, role: JobRole.QA }),
    });
  });

  it('offers the values of the group with their descriptions', async () => {
    expect(
      await open(button('trtadd:dim:priority'), dialog('dim', { label: LABEL, role: null })),
    ).toEqual({
      screen: {
        text: [
          locale.traitAdd.chooseValue(BOLD, 'for everyone', 'Priority'),
          '',
          '**Critical** — Needed right now',
          '**High** — Needed soon',
          '**Medium** — As planned',
          '**Low** — When there is time',
        ].join('\n'),
        buttons: [
          [
            { text: 'Critical', data: 'trtadd:val:critical' },
            { text: 'High', data: 'trtadd:val:high' },
          ],
          [
            { text: 'Medium', data: 'trtadd:val:medium' },
            { text: 'Low', data: 'trtadd:val:low' },
          ],
          [{ text: '‹ Back', data: 'trtadd:dims' }, CANCEL],
        ],
      },
      dialog: dialog('val', {
        label: LABEL,
        role: null,
        dimension: TraitDimension.PRIORITY,
      }),
    });
  });

  it('goes back to the groups', async () => {
    const reply = await open(
      button('trtadd:dims'),
      dialog('val', {
        label: LABEL,
        role: null,
        dimension: TraitDimension.PRIORITY,
      }),
    );

    expect(reply.screen.text).toBe(locale.traitAdd.chooseDimension(BOLD, 'for everyone'));
    expect(reply.dialog).toEqual(dialog('dim', { label: LABEL, role: null }));
  });

  it('maps the label to our value', async () => {
    traitService.addValue.mockResolvedValue(MAPPING);

    expect(
      await open(
        button('trtadd:val:low'),
        dialog('val', {
          label: LABEL,
          role: null,
          dimension: TraitDimension.PRIORITY,
        }),
      ),
    ).toEqual({
      screen: {
        text: locale.traitAdd.added(BOLD, 'for everyone', 'Priority: Low'),
        buttons: [[CARD], [{ text: 'Add another', data: 'trtadd:start' }], [LIST]],
      },
      dialog: null,
    });
    expect(traitService.addValue).toHaveBeenCalledWith({
      source: Source.GITLAB,
      sourceName: LABEL,
      role: null,
      dimension: TraitDimension.PRIORITY,
      value: Priority.LOW,
    });
  });

  it('says the value is already set when the row exists', async () => {
    traitService.addValue.mockResolvedValue(null);
    traitService.findByKey.mockResolvedValue([MAPPING]);

    const { screen } = await open(
      button('trtadd:val:low'),
      dialog('val', {
        label: LABEL,
        role: null,
        dimension: TraitDimension.PRIORITY,
      }),
    );

    expect(screen).toEqual({
      text: locale.traitAdd.alreadySet(BOLD),
      buttons: [[CARD], [LIST]],
    });
  });

  it('refuses a value of another group', async () => {
    const reply = await open(
      button('trtadd:val:blocked'),
      dialog('val', {
        label: LABEL,
        role: null,
        dimension: TraitDimension.PRIORITY,
      }),
    );

    expect(reply.screen).toEqual({ text: locale.bot.expired });
    expect(traitService.addValue).not.toHaveBeenCalled();
  });

  it.each<[string, BotDialog | null]>([
    ['trtadd:role:all', null],
    ['trtadd:dim:priority', dialog('role', { label: LABEL })],
    ['trtadd:val:low', dialog('dim', { label: LABEL, role: null })],
    ['trtadd:dims', dialog('dim', { label: LABEL, role: null })],
  ])('answers %s without its step as outdated', async (data, current) => {
    expect((await open(button(data), current)).screen).toEqual({
      text: locale.bot.expired,
    });
  });

  it('cancels adding', async () => {
    expect(await open(button('trtadd:cancel'))).toEqual({
      screen: { text: locale.traitAdd.cancelled, buttons: [[LIST]] },
      dialog: null,
    });
  });

  it.each(['trtadd:role:boss', 'trtadd:dim:mood', 'trtadd:val', 'trtadd:x'])(
    'answers the outdated button %s',
    async (data) => {
      expect((await open(button(data))).screen).toEqual({
        text: locale.bot.expired,
      });
    },
  );
});
