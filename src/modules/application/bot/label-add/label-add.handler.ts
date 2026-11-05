import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import { LABEL_SCOPE_SEPARATOR } from 'src/common/constants/label.constants';
import type { ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { toLabelKey } from 'src/common/utils/label.util';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type {
  LabelValueText,
  Locale,
} from 'src/modules/application/i18n/i18n.interface';
import {
  LABEL_DICTIONARY,
  LABEL_MAX_LENGTH,
} from 'src/modules/application/label/constants/label.constants';
import { LabelDimension } from 'src/modules/application/label/label.enums';
import type {
  LabelMapping,
  LabelValue,
} from 'src/modules/application/label/label.interface';
import { LabelService } from 'src/modules/application/label/label.service';
import { JobRole, Permission } from 'src/modules/application/user/user.enums';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotNamespace } from '../bot.enums';
import type {
  BotActor,
  BotContext,
  BotDialog,
  BotHandler,
  BotReply,
} from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import { LabelsAction } from '../labels/labels.enums';
import {
  LABEL_ADD_BUTTON_SCHEMA,
  LABEL_ADD_BUTTONS_PER_ROW,
  LABEL_ADD_DRAFT_SCHEMA,
  LABEL_ADD_EVERYONE,
  LABEL_ADD_VALUE_SCHEMAS,
} from './constants/label-add.constants';
import { LabelAddMessages } from './constants/label-add.messages';
import { LabelAddAction, LabelAddStep } from './label-add.enums';

@Injectable()
@BotSection({ access: Permission.LABELS, namespace: BotNamespace.LABEL_ADD })
export class LabelAddHandler implements BotHandler {
  private readonly logger = new Logger(LabelAddHandler.name);

  constructor(private readonly labelService: LabelService) {}

  async handle({
    actor,
    input,
    dialog,
    locale,
  }: BotContext): Promise<BotReply> {
    if (input.type === ChatInputType.TEXT) {
      return this.receiveLabel(locale, input.text);
    }
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }

    const button = LABEL_ADD_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case LabelAddAction.START:
        return this.askLabel(locale);
      case LabelAddAction.MORE:
        return this.addToLabel(locale, button.data.id);
      case LabelAddAction.ROLE:
        return this.chooseRole(locale, dialog, button.data.role);
      case LabelAddAction.DIMENSIONS:
        return this.backToDimensions(locale, dialog);
      case LabelAddAction.DIMENSION:
        return this.chooseDimension(locale, dialog, button.data.dimension);
      case LabelAddAction.VALUE:
        return this.create(actor, locale, dialog, button.data.value);
      case LabelAddAction.CANCEL:
        return {
          screen: {
            text: locale.labelAdd.cancelled,
            buttons: [[this.toListButton(locale)]],
          },
          dialog: null,
        };
    }
  }

  private askLabel(locale: Locale, text = locale.labelAdd.prompt): BotReply {
    return {
      screen: { text, buttons: [[this.toCancelButton(locale)]] },
      dialog: this.toDialog(LabelAddStep.LABEL, {}),
    };
  }

  private async receiveLabel(locale: Locale, text: string): Promise<BotReply> {
    const label = text.trim();
    const labelKey = toLabelKey(label);
    if (
      label.length > LABEL_MAX_LENGTH ||
      labelKey.split(LABEL_SCOPE_SEPARATOR).some((part) => part === '')
    ) {
      return this.askLabel(locale, locale.labelAdd.invalid(LABEL_MAX_LENGTH));
    }
    const [existing] = await this.labelService.findByKey(labelKey);
    if (existing) {
      return this.showExisting(
        locale,
        existing,
        locale.labelAdd.exists(this.toLabelText(existing.label)),
      );
    }
    return this.askRole(locale, label);
  }

  private async addToLabel(locale: Locale, id: string): Promise<BotReply> {
    const mapping = await this.labelService.findById(id);
    if (!mapping) {
      return {
        screen: {
          text: locale.labelList.notFound,
          buttons: [[this.toListButton(locale)]],
        },
        dialog: null,
      };
    }
    return this.askRole(locale, mapping.label);
  }

  private askRole(locale: Locale, label: string): BotReply {
    return {
      screen: {
        text: locale.labelAdd.forWhom(this.toLabelText(label)),
        buttons: [
          [
            {
              text: locale.labelAdd.everyone,
              data: this.toData(LabelAddAction.ROLE, LABEL_ADD_EVERYONE),
            },
          ],
          ...this.toRows(
            Object.values(JobRole).map((role) => ({
              text: locale.roles[role],
              data: this.toData(LabelAddAction.ROLE, role),
            })),
          ),
          [this.toCancelButton(locale)],
        ],
      },
      dialog: this.toDialog(LabelAddStep.ROLE, { label }),
    };
  }

  private chooseRole(
    locale: Locale,
    dialog: BotDialog | null,
    role: JobRole | null,
  ): BotReply {
    const draft = this.readDraft(dialog, LabelAddStep.ROLE);
    if (!draft) {
      return { screen: { text: locale.bot.expired } };
    }
    return this.askDimension(locale, draft.label, role);
  }

  private backToDimensions(locale: Locale, dialog: BotDialog | null) {
    const draft = this.readDraft(dialog, LabelAddStep.VALUE);
    if (draft?.role === undefined) {
      return { screen: { text: locale.bot.expired } };
    }
    return this.askDimension(locale, draft.label, draft.role);
  }

  private askDimension(
    locale: Locale,
    label: string,
    role: JobRole | null,
  ): BotReply {
    return {
      screen: {
        text: locale.labelAdd.chooseDimension(
          this.toLabelText(label),
          this.toWhom(locale, role),
        ),
        buttons: [
          ...this.toRows(
            Object.values(LabelDimension).map((dimension) => ({
              text: locale.labels.dimensions[dimension],
              data: this.toData(LabelAddAction.DIMENSION, dimension),
            })),
          ),
          [this.toCancelButton(locale)],
        ],
      },
      dialog: this.toDialog(LabelAddStep.DIMENSION, { label, role }),
    };
  }

  private chooseDimension(
    locale: Locale,
    dialog: BotDialog | null,
    dimension: LabelDimension,
  ): BotReply {
    const draft = this.readDraft(dialog, LabelAddStep.DIMENSION);
    if (draft?.role === undefined) {
      return { screen: { text: locale.bot.expired } };
    }
    const { label, role } = draft;
    const values: readonly LabelValue[] = LABEL_DICTIONARY[dimension];

    return {
      screen: {
        text: [
          locale.labelAdd.chooseValue(
            this.toLabelText(label),
            this.toWhom(locale, role),
            locale.labels.dimensions[dimension],
          ),
          '',
          ...values.map((value) => {
            const { name, description } = this.toValueText(
              locale,
              dimension,
              value,
            );
            return `**${name}** — ${description}`;
          }),
        ].join('\n'),
        buttons: [
          ...this.toRows(
            values.map((value) => ({
              text: this.toValueText(locale, dimension, value).name,
              data: this.toData(LabelAddAction.VALUE, value),
            })),
          ),
          [
            {
              text: locale.labelAdd.back,
              data: this.toData(LabelAddAction.DIMENSIONS),
            },
            this.toCancelButton(locale),
          ],
        ],
      },
      dialog: this.toDialog(LabelAddStep.VALUE, { label, role, dimension }),
    };
  }

  private async create(
    actor: BotActor,
    locale: Locale,
    dialog: BotDialog | null,
    input: string,
  ): Promise<BotReply> {
    const draft = this.readDraft(dialog, LabelAddStep.VALUE);
    if (draft?.role === undefined || !draft.dimension) {
      return { screen: { text: locale.bot.expired } };
    }
    const { label, role, dimension } = draft;
    const value = LABEL_ADD_VALUE_SCHEMAS[dimension].safeParse(input);
    if (!value.success) {
      return { screen: { text: locale.bot.expired } };
    }

    const mapping = await this.labelService.addValue({
      label,
      role,
      dimension,
      value: value.data,
    });
    if (!mapping) {
      const [existing] = await this.labelService.findByKey(toLabelKey(label));
      return existing
        ? this.showExisting(
            locale,
            existing,
            locale.labelAdd.alreadySet(this.toLabelText(existing.label)),
          )
        : { screen: { text: locale.bot.expired }, dialog: null };
    }
    this.logger.log(
      {
        labelKey: mapping.labelKey,
        role,
        dimension,
        value: mapping.value,
        actorId: actor.user?.id ?? BotAccess.OWNER,
      },
      LabelAddMessages.MAPPING_ADDED,
    );

    return {
      screen: {
        text: locale.labelAdd.added(
          this.toLabelText(mapping.label),
          this.toWhom(locale, role),
          `${locale.labels.dimensions[dimension]}: ${this.toValueText(locale, dimension, mapping.value).name}`,
        ),
        buttons: [
          [this.toCardButton(locale, mapping.id)],
          [
            {
              text: locale.labelAdd.addMore,
              data: this.toData(LabelAddAction.START),
            },
          ],
          [this.toListButton(locale)],
        ],
      },
      dialog: null,
    };
  }

  private showExisting(
    locale: Locale,
    mapping: LabelMapping,
    text: string,
  ): BotReply {
    return {
      screen: {
        text,
        buttons: [
          [this.toCardButton(locale, mapping.id)],
          [this.toListButton(locale)],
        ],
      },
      dialog: null,
    };
  }

  private toValueText(
    locale: Locale,
    dimension: LabelDimension,
    value: LabelValue,
  ) {
    const texts: Record<string, LabelValueText> =
      locale.labels.values[dimension];
    return texts[value];
  }

  private toWhom(locale: Locale, role: JobRole | null) {
    return role
      ? locale.labelAdd.forRole(locale.roles[role])
      : locale.labelAdd.forEveryone;
  }

  private toLabelText(label: string) {
    return `**${escapeMarkdown(label)}**`;
  }

  private toRows(buttons: ScreenButton[]) {
    const rows: ScreenButton[][] = [];
    for (
      let index = 0;
      index < buttons.length;
      index += LABEL_ADD_BUTTONS_PER_ROW
    ) {
      rows.push(buttons.slice(index, index + LABEL_ADD_BUTTONS_PER_ROW));
    }
    return rows;
  }

  private readDraft(dialog: BotDialog | null, step: string) {
    if (dialog?.namespace !== BotNamespace.LABEL_ADD || dialog.step !== step) {
      return null;
    }
    const draft = LABEL_ADD_DRAFT_SCHEMA.safeParse(dialog.data);
    return draft.success ? draft.data : null;
  }

  private toDialog(step: LabelAddStep, data: Record<string, unknown>) {
    return { namespace: BotNamespace.LABEL_ADD, step, data };
  }

  private toData(...parts: string[]) {
    return [BotNamespace.LABEL_ADD, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }

  private toCancelButton(locale: Locale) {
    return {
      text: locale.labelAdd.cancel,
      data: this.toData(LabelAddAction.CANCEL),
    };
  }

  private toCardButton(locale: Locale, id: string) {
    return {
      text: locale.labelAdd.openCard,
      data: [BotNamespace.LABELS, LabelsAction.CARD, id, 0].join(
        BOT_BUTTON_DATA_SEPARATOR,
      ),
    };
  }

  private toListButton(locale: Locale) {
    return {
      text: locale.labelList.backToList,
      data: [BotNamespace.LABELS, LabelsAction.LIST, 0].join(
        BOT_BUTTON_DATA_SEPARATOR,
      ),
    };
  }
}
