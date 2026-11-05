import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import { SOURCE_NAME_SCOPE_SEPARATOR } from 'src/common/constants/source-name.constants';
import type { ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { toSourceKey } from 'src/common/utils/source-name.util';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type {
  TraitValueText,
  Locale,
} from 'src/modules/application/i18n/i18n.interface';
import {
  TRAIT_DICTIONARY,
  TRAIT_SOURCE_NAME_MAX_LENGTH,
} from 'src/modules/application/trait/constants/trait.constants';
import { TraitDimension } from 'src/modules/application/trait/trait.enums';
import type {
  TraitMapping,
  TraitValue,
} from 'src/modules/application/trait/trait.interface';
import { Source } from 'src/modules/application/source/source.enums';
import { TraitService } from 'src/modules/application/trait/trait.service';
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
import { TraitsAction } from '../traits/traits.enums';
import {
  TRAIT_ADD_BUTTON_SCHEMA,
  TRAIT_ADD_BUTTONS_PER_ROW,
  TRAIT_ADD_DRAFT_SCHEMA,
  TRAIT_ADD_EVERYONE,
  TRAIT_ADD_VALUE_SCHEMAS,
} from './constants/trait-add.constants';
import { TraitAddMessages } from './constants/trait-add.messages';
import { TraitAddAction, TraitAddStep } from './trait-add.enums';

@Injectable()
@BotSection({ access: Permission.TRAITS, namespace: BotNamespace.TRAIT_ADD })
export class TraitAddHandler implements BotHandler {
  private readonly logger = new Logger(TraitAddHandler.name);

  constructor(private readonly traitService: TraitService) {}

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

    const button = TRAIT_ADD_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case TraitAddAction.START:
        return this.askLabel(locale);
      case TraitAddAction.MORE:
        return this.addToLabel(locale, button.data.id);
      case TraitAddAction.ROLE:
        return this.chooseRole(locale, dialog, button.data.role);
      case TraitAddAction.DIMENSIONS:
        return this.backToDimensions(locale, dialog);
      case TraitAddAction.DIMENSION:
        return this.chooseDimension(locale, dialog, button.data.dimension);
      case TraitAddAction.VALUE:
        return this.create(actor, locale, dialog, button.data.value);
      case TraitAddAction.CANCEL:
        return {
          screen: {
            text: locale.traitAdd.cancelled,
            buttons: [[this.toListButton(locale)]],
          },
          dialog: null,
        };
    }
  }

  private askLabel(locale: Locale, text = locale.traitAdd.prompt): BotReply {
    return {
      screen: { text, buttons: [[this.toCancelButton(locale)]] },
      dialog: this.toDialog(TraitAddStep.LABEL, {}),
    };
  }

  private async receiveLabel(locale: Locale, text: string): Promise<BotReply> {
    const label = text.trim();
    const sourceKey = toSourceKey(label);
    if (
      label.length > TRAIT_SOURCE_NAME_MAX_LENGTH ||
      sourceKey.split(SOURCE_NAME_SCOPE_SEPARATOR).some((part) => part === '')
    ) {
      return this.askLabel(
        locale,
        locale.traitAdd.invalid(TRAIT_SOURCE_NAME_MAX_LENGTH),
      );
    }
    const [existing] = await this.traitService.findByKey(
      Source.GITLAB,
      sourceKey,
    );
    if (existing) {
      return this.showExisting(
        locale,
        existing,
        locale.traitAdd.exists(this.toLabelText(existing.sourceName)),
      );
    }
    return this.askRole(locale, label);
  }

  private async addToLabel(locale: Locale, id: string): Promise<BotReply> {
    const mapping = await this.traitService.findById(id);
    if (!mapping) {
      return {
        screen: {
          text: locale.traitList.notFound,
          buttons: [[this.toListButton(locale)]],
        },
        dialog: null,
      };
    }
    return this.askRole(locale, mapping.sourceName);
  }

  private askRole(locale: Locale, label: string): BotReply {
    return {
      screen: {
        text: locale.traitAdd.forWhom(this.toLabelText(label)),
        buttons: [
          [
            {
              text: locale.traitAdd.everyone,
              data: this.toData(TraitAddAction.ROLE, TRAIT_ADD_EVERYONE),
            },
          ],
          ...this.toRows(
            Object.values(JobRole).map((role) => ({
              text: locale.roles[role],
              data: this.toData(TraitAddAction.ROLE, role),
            })),
          ),
          [this.toCancelButton(locale)],
        ],
      },
      dialog: this.toDialog(TraitAddStep.ROLE, { label }),
    };
  }

  private chooseRole(
    locale: Locale,
    dialog: BotDialog | null,
    role: JobRole | null,
  ): BotReply {
    const draft = this.readDraft(dialog, TraitAddStep.ROLE);
    if (!draft) {
      return { screen: { text: locale.bot.expired } };
    }
    return this.askDimension(locale, draft.label, role);
  }

  private backToDimensions(locale: Locale, dialog: BotDialog | null) {
    const draft = this.readDraft(dialog, TraitAddStep.VALUE);
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
        text: locale.traitAdd.chooseDimension(
          this.toLabelText(label),
          this.toWhom(locale, role),
        ),
        buttons: [
          ...this.toRows(
            Object.values(TraitDimension).map((dimension) => ({
              text: locale.traits.dimensions[dimension],
              data: this.toData(TraitAddAction.DIMENSION, dimension),
            })),
          ),
          [this.toCancelButton(locale)],
        ],
      },
      dialog: this.toDialog(TraitAddStep.DIMENSION, { label, role }),
    };
  }

  private chooseDimension(
    locale: Locale,
    dialog: BotDialog | null,
    dimension: TraitDimension,
  ): BotReply {
    const draft = this.readDraft(dialog, TraitAddStep.DIMENSION);
    if (draft?.role === undefined) {
      return { screen: { text: locale.bot.expired } };
    }
    const { label, role } = draft;
    const values: readonly TraitValue[] = TRAIT_DICTIONARY[dimension];

    return {
      screen: {
        text: [
          locale.traitAdd.chooseValue(
            this.toLabelText(label),
            this.toWhom(locale, role),
            locale.traits.dimensions[dimension],
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
              data: this.toData(TraitAddAction.VALUE, value),
            })),
          ),
          [
            {
              text: locale.traitAdd.back,
              data: this.toData(TraitAddAction.DIMENSIONS),
            },
            this.toCancelButton(locale),
          ],
        ],
      },
      dialog: this.toDialog(TraitAddStep.VALUE, { label, role, dimension }),
    };
  }

  private async create(
    actor: BotActor,
    locale: Locale,
    dialog: BotDialog | null,
    input: string,
  ): Promise<BotReply> {
    const draft = this.readDraft(dialog, TraitAddStep.VALUE);
    if (draft?.role === undefined || !draft.dimension) {
      return { screen: { text: locale.bot.expired } };
    }
    const { label, role, dimension } = draft;
    const value = TRAIT_ADD_VALUE_SCHEMAS[dimension].safeParse(input);
    if (!value.success) {
      return { screen: { text: locale.bot.expired } };
    }

    const mapping = await this.traitService.addValue({
      source: Source.GITLAB,
      sourceName: label,
      role,
      dimension,
      value: value.data,
    });
    if (!mapping) {
      const [existing] = await this.traitService.findByKey(
        Source.GITLAB,
        toSourceKey(label),
      );
      return existing
        ? this.showExisting(
            locale,
            existing,
            locale.traitAdd.alreadySet(this.toLabelText(existing.sourceName)),
          )
        : { screen: { text: locale.bot.expired }, dialog: null };
    }
    this.logger.log(
      {
        source: mapping.source,
        sourceKey: mapping.sourceKey,
        role,
        dimension,
        value: mapping.value,
        actorId: actor.user?.id ?? BotAccess.OWNER,
      },
      TraitAddMessages.MAPPING_ADDED,
    );

    return {
      screen: {
        text: locale.traitAdd.added(
          this.toLabelText(mapping.sourceName),
          this.toWhom(locale, role),
          `${locale.traits.dimensions[dimension]}: ${this.toValueText(locale, dimension, mapping.value).name}`,
        ),
        buttons: [
          [this.toCardButton(locale, mapping.id)],
          [
            {
              text: locale.traitAdd.addMore,
              data: this.toData(TraitAddAction.START),
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
    mapping: TraitMapping,
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
    dimension: TraitDimension,
    value: TraitValue,
  ) {
    const texts: Record<string, TraitValueText> =
      locale.traits.values[dimension];
    return texts[value];
  }

  private toWhom(locale: Locale, role: JobRole | null) {
    return role
      ? locale.traitAdd.forRole(locale.roles[role])
      : locale.traitAdd.forEveryone;
  }

  private toLabelText(label: string) {
    return `**${escapeMarkdown(label)}**`;
  }

  private toRows(buttons: ScreenButton[]) {
    const rows: ScreenButton[][] = [];
    for (
      let index = 0;
      index < buttons.length;
      index += TRAIT_ADD_BUTTONS_PER_ROW
    ) {
      rows.push(buttons.slice(index, index + TRAIT_ADD_BUTTONS_PER_ROW));
    }
    return rows;
  }

  private readDraft(dialog: BotDialog | null, step: string) {
    if (dialog?.namespace !== BotNamespace.TRAIT_ADD || dialog.step !== step) {
      return null;
    }
    const draft = TRAIT_ADD_DRAFT_SCHEMA.safeParse(dialog.data);
    return draft.success ? draft.data : null;
  }

  private toDialog(step: TraitAddStep, data: Record<string, unknown>) {
    return { namespace: BotNamespace.TRAIT_ADD, step, data };
  }

  private toData(...parts: string[]) {
    return [BotNamespace.TRAIT_ADD, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }

  private toCancelButton(locale: Locale) {
    return {
      text: locale.traitAdd.cancel,
      data: this.toData(TraitAddAction.CANCEL),
    };
  }

  private toCardButton(locale: Locale, id: string) {
    return {
      text: locale.traitAdd.openCard,
      data: [BotNamespace.TRAITS, TraitsAction.CARD, id, 0].join(
        BOT_BUTTON_DATA_SEPARATOR,
      ),
    };
  }

  private toListButton(locale: Locale) {
    return {
      text: locale.traitList.backToList,
      data: [BotNamespace.TRAITS, TraitsAction.LIST, 0].join(
        BOT_BUTTON_DATA_SEPARATOR,
      ),
    };
  }
}
