import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import type { ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type {
  TraitValueText,
  Locale,
} from 'src/modules/application/i18n/i18n.interface';
import { TRAIT_DICTIONARY } from 'src/modules/application/trait/constants/trait.constants';
import type { TraitDimension } from 'src/modules/application/trait/trait.enums';
import type {
  TraitMapping,
  TraitValue,
} from 'src/modules/application/trait/trait.interface';
import { TraitService } from 'src/modules/application/trait/trait.service';
import { Permission } from 'src/modules/application/user/user.enums';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotNamespace } from '../bot.enums';
import type {
  BotActor,
  BotContext,
  BotHandler,
  BotReply,
} from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import { TraitsAction } from '../traits/traits.enums';
import {
  TRAIT_MANAGE_BUTTON_SCHEMA,
  TRAIT_MANAGE_BUTTONS_PER_ROW,
  TRAIT_MANAGE_CURRENT_MARK,
} from './constants/trait-manage.constants';
import { TraitManageMessages } from './constants/trait-manage.messages';
import { TraitManageAction } from './trait-manage.enums';

@Injectable()
@BotSection({
  access: Permission.TRAITS,
  namespace: BotNamespace.TRAIT_MANAGE,
})
export class TraitManageHandler implements BotHandler {
  private readonly logger = new Logger(TraitManageHandler.name);

  constructor(private readonly traitService: TraitService) {}

  async handle({ actor, input, locale }: BotContext): Promise<BotReply> {
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }
    const button = TRAIT_MANAGE_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }

    const mapping = await this.traitService.findById(button.data.id);
    if (!mapping) {
      return this.reply(locale.traitList.notFound, [
        [this.toListButton(locale)],
      ]);
    }
    switch (button.data.action) {
      case TraitManageAction.OPEN:
        return this.askValue(locale, mapping);
      case TraitManageAction.SET:
        return this.changeValue(actor, locale, mapping, button.data.index);
      case TraitManageAction.DELETE:
        return this.deleteValue(actor, locale, mapping);
      case TraitManageAction.DROP:
        return this.confirmDrop(locale, mapping);
      case TraitManageAction.CONFIRM_DROP:
        return this.drop(actor, locale, mapping);
    }
  }

  private askValue(locale: Locale, mapping: TraitMapping): BotReply {
    const { traitManage } = locale;
    const values: readonly TraitValue[] = TRAIT_DICTIONARY[mapping.dimension];
    return this.reply(
      [
        traitManage.askValue(
          this.toLabelText(mapping.sourceName),
          this.toWhom(locale, mapping),
          locale.traits.dimensions[mapping.dimension],
          this.toValueText(locale, mapping.dimension, mapping.value).name,
        ),
        '',
        ...values.map((value) => {
          const { name, description } = this.toValueText(
            locale,
            mapping.dimension,
            value,
          );
          return `**${name}** — ${description}`;
        }),
      ].join('\n'),
      [
        ...this.toRows(
          values.map((value, index) => ({
            text: `${value === mapping.value ? TRAIT_MANAGE_CURRENT_MARK : ''}${this.toValueText(locale, mapping.dimension, value).name}`,
            data: this.toData(TraitManageAction.SET, mapping.id, String(index)),
          })),
        ),
        [
          {
            text: traitManage.deleteValue,
            data: this.toData(TraitManageAction.DELETE, mapping.id),
          },
        ],
        [{ text: traitManage.back, data: this.toCardData(mapping.id) }],
      ],
    );
  }

  private async changeValue(
    actor: BotActor,
    locale: Locale,
    mapping: TraitMapping,
    index: number,
  ): Promise<BotReply> {
    const values: readonly TraitValue[] = TRAIT_DICTIONARY[mapping.dimension];
    if (index >= values.length) {
      return { screen: { text: locale.bot.expired } };
    }
    const value = values[index];
    if (value !== mapping.value) {
      if (!(await this.traitService.changeValue(mapping.id, value))) {
        return this.reply(locale.traitList.notFound, [
          [this.toListButton(locale)],
        ]);
      }
      this.log(actor, mapping, TraitManageMessages.VALUE_CHANGED, value);
    }

    return this.reply(
      locale.traitManage.changed(
        this.toLabelText(mapping.sourceName),
        this.toWhom(locale, mapping),
        this.describe(locale, mapping.dimension, value),
      ),
      [[this.toCardButton(locale, mapping.id)], [this.toListButton(locale)]],
    );
  }

  private async deleteValue(
    actor: BotActor,
    locale: Locale,
    mapping: TraitMapping,
  ): Promise<BotReply> {
    await this.traitService.deleteById(mapping.id);
    this.log(actor, mapping, TraitManageMessages.VALUE_DELETED, mapping.value);

    const text = locale.traitManage.valueDeleted(
      this.toLabelText(mapping.sourceName),
      this.toWhom(locale, mapping),
      this.describe(locale, mapping.dimension, mapping.value),
    );
    const [remaining] = await this.traitService.findByKey(
      mapping.source,
      mapping.sourceKey,
    );
    return remaining
      ? this.reply(text, [
          [this.toCardButton(locale, remaining.id)],
          [this.toListButton(locale)],
        ])
      : this.reply([text, locale.traitManage.labelEmpty].join('\n\n'), [
          [this.toListButton(locale)],
        ]);
  }

  private async confirmDrop(
    locale: Locale,
    mapping: TraitMapping,
  ): Promise<BotReply> {
    const mappings = await this.traitService.findByKey(
      mapping.source,
      mapping.sourceKey,
    );
    return this.reply(
      locale.traitManage.confirmDrop(
        this.toLabelText(mapping.sourceName),
        mappings.length,
      ),
      [
        [
          {
            text: locale.traitManage.confirm,
            data: this.toData(TraitManageAction.CONFIRM_DROP, mapping.id),
          },
          {
            text: locale.traitManage.cancel,
            data: this.toCardData(mapping.id),
          },
        ],
      ],
    );
  }

  private async drop(
    actor: BotActor,
    locale: Locale,
    mapping: TraitMapping,
  ): Promise<BotReply> {
    await this.traitService.deleteByKey(mapping.source, mapping.sourceKey);
    this.log(actor, mapping, TraitManageMessages.LABEL_DELETED);
    return this.reply(
      locale.traitManage.dropped(this.toLabelText(mapping.sourceName)),
      [[this.toListButton(locale)]],
    );
  }

  private log(
    actor: BotActor,
    mapping: TraitMapping,
    message: TraitManageMessages,
    value?: TraitValue,
  ) {
    this.logger.log(
      {
        source: mapping.source,
        sourceKey: mapping.sourceKey,
        role: mapping.role,
        dimension: mapping.dimension,
        value,
        actorId: actor.user?.id ?? BotAccess.OWNER,
      },
      message,
    );
  }

  private describe(
    locale: Locale,
    dimension: TraitDimension,
    value: TraitValue,
  ) {
    return `${locale.traits.dimensions[dimension]}: ${this.toValueText(locale, dimension, value).name}`;
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

  private toWhom(locale: Locale, { role }: TraitMapping) {
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
      index += TRAIT_MANAGE_BUTTONS_PER_ROW
    ) {
      rows.push(buttons.slice(index, index + TRAIT_MANAGE_BUTTONS_PER_ROW));
    }
    return rows;
  }

  private reply(text: string, buttons: ScreenButton[][]): BotReply {
    return { screen: { text, buttons }, dialog: null };
  }

  private toData(...parts: string[]) {
    return [BotNamespace.TRAIT_MANAGE, ...parts].join(
      BOT_BUTTON_DATA_SEPARATOR,
    );
  }

  private toCardData(id: string) {
    return [BotNamespace.TRAITS, TraitsAction.CARD, id, 0].join(
      BOT_BUTTON_DATA_SEPARATOR,
    );
  }

  private toCardButton(locale: Locale, id: string) {
    return { text: locale.traitAdd.openCard, data: this.toCardData(id) };
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
