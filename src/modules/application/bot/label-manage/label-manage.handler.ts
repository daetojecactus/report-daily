import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import type { ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type {
  LabelValueText,
  Locale,
} from 'src/modules/application/i18n/i18n.interface';
import { LABEL_DICTIONARY } from 'src/modules/application/label/constants/label.constants';
import type { LabelDimension } from 'src/modules/application/label/label.enums';
import type {
  LabelMapping,
  LabelValue,
} from 'src/modules/application/label/label.interface';
import { LabelService } from 'src/modules/application/label/label.service';
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
import { LabelsAction } from '../labels/labels.enums';
import {
  LABEL_MANAGE_BUTTON_SCHEMA,
  LABEL_MANAGE_BUTTONS_PER_ROW,
  LABEL_MANAGE_CURRENT_MARK,
} from './constants/label-manage.constants';
import { LabelManageMessages } from './constants/label-manage.messages';
import { LabelManageAction } from './label-manage.enums';

@Injectable()
@BotSection({
  access: Permission.LABELS,
  namespace: BotNamespace.LABEL_MANAGE,
})
export class LabelManageHandler implements BotHandler {
  private readonly logger = new Logger(LabelManageHandler.name);

  constructor(private readonly labelService: LabelService) {}

  async handle({ actor, input, locale }: BotContext): Promise<BotReply> {
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }
    const button = LABEL_MANAGE_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }

    const mapping = await this.labelService.findById(button.data.id);
    if (!mapping) {
      return this.reply(locale.labelList.notFound, [
        [this.toListButton(locale)],
      ]);
    }
    switch (button.data.action) {
      case LabelManageAction.OPEN:
        return this.askValue(locale, mapping);
      case LabelManageAction.SET:
        return this.changeValue(actor, locale, mapping, button.data.index);
      case LabelManageAction.DELETE:
        return this.deleteValue(actor, locale, mapping);
      case LabelManageAction.DROP:
        return this.confirmDrop(locale, mapping);
      case LabelManageAction.CONFIRM_DROP:
        return this.drop(actor, locale, mapping);
    }
  }

  private askValue(locale: Locale, mapping: LabelMapping): BotReply {
    const { labelManage } = locale;
    const values: readonly LabelValue[] = LABEL_DICTIONARY[mapping.dimension];
    return this.reply(
      [
        labelManage.askValue(
          this.toLabelText(mapping.label),
          this.toWhom(locale, mapping),
          locale.labels.dimensions[mapping.dimension],
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
            text: `${value === mapping.value ? LABEL_MANAGE_CURRENT_MARK : ''}${this.toValueText(locale, mapping.dimension, value).name}`,
            data: this.toData(LabelManageAction.SET, mapping.id, String(index)),
          })),
        ),
        [
          {
            text: labelManage.deleteValue,
            data: this.toData(LabelManageAction.DELETE, mapping.id),
          },
        ],
        [{ text: labelManage.back, data: this.toCardData(mapping.id) }],
      ],
    );
  }

  private async changeValue(
    actor: BotActor,
    locale: Locale,
    mapping: LabelMapping,
    index: number,
  ): Promise<BotReply> {
    const values: readonly LabelValue[] = LABEL_DICTIONARY[mapping.dimension];
    if (index >= values.length) {
      return { screen: { text: locale.bot.expired } };
    }
    const value = values[index];
    if (value !== mapping.value) {
      if (!(await this.labelService.changeValue(mapping.id, value))) {
        return this.reply(locale.labelList.notFound, [
          [this.toListButton(locale)],
        ]);
      }
      this.log(actor, mapping, LabelManageMessages.VALUE_CHANGED, value);
    }

    return this.reply(
      locale.labelManage.changed(
        this.toLabelText(mapping.label),
        this.toWhom(locale, mapping),
        this.describe(locale, mapping.dimension, value),
      ),
      [[this.toCardButton(locale, mapping.id)], [this.toListButton(locale)]],
    );
  }

  private async deleteValue(
    actor: BotActor,
    locale: Locale,
    mapping: LabelMapping,
  ): Promise<BotReply> {
    await this.labelService.deleteById(mapping.id);
    this.log(actor, mapping, LabelManageMessages.VALUE_DELETED, mapping.value);

    const text = locale.labelManage.valueDeleted(
      this.toLabelText(mapping.label),
      this.toWhom(locale, mapping),
      this.describe(locale, mapping.dimension, mapping.value),
    );
    const [remaining] = await this.labelService.findByKey(mapping.labelKey);
    return remaining
      ? this.reply(text, [
          [this.toCardButton(locale, remaining.id)],
          [this.toListButton(locale)],
        ])
      : this.reply([text, locale.labelManage.labelEmpty].join('\n\n'), [
          [this.toListButton(locale)],
        ]);
  }

  private async confirmDrop(
    locale: Locale,
    mapping: LabelMapping,
  ): Promise<BotReply> {
    const mappings = await this.labelService.findByKey(mapping.labelKey);
    return this.reply(
      locale.labelManage.confirmDrop(
        this.toLabelText(mapping.label),
        mappings.length,
      ),
      [
        [
          {
            text: locale.labelManage.confirm,
            data: this.toData(LabelManageAction.CONFIRM_DROP, mapping.id),
          },
          {
            text: locale.labelManage.cancel,
            data: this.toCardData(mapping.id),
          },
        ],
      ],
    );
  }

  private async drop(
    actor: BotActor,
    locale: Locale,
    mapping: LabelMapping,
  ): Promise<BotReply> {
    await this.labelService.deleteByKey(mapping.labelKey);
    this.log(actor, mapping, LabelManageMessages.LABEL_DELETED);
    return this.reply(
      locale.labelManage.dropped(this.toLabelText(mapping.label)),
      [[this.toListButton(locale)]],
    );
  }

  private log(
    actor: BotActor,
    mapping: LabelMapping,
    message: LabelManageMessages,
    value?: LabelValue,
  ) {
    this.logger.log(
      {
        labelKey: mapping.labelKey,
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
    dimension: LabelDimension,
    value: LabelValue,
  ) {
    return `${locale.labels.dimensions[dimension]}: ${this.toValueText(locale, dimension, value).name}`;
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

  private toWhom(locale: Locale, { role }: LabelMapping) {
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
      index += LABEL_MANAGE_BUTTONS_PER_ROW
    ) {
      rows.push(buttons.slice(index, index + LABEL_MANAGE_BUTTONS_PER_ROW));
    }
    return rows;
  }

  private reply(text: string, buttons: ScreenButton[][]): BotReply {
    return { screen: { text, buttons }, dialog: null };
  }

  private toData(...parts: string[]) {
    return [BotNamespace.LABEL_MANAGE, ...parts].join(
      BOT_BUTTON_DATA_SEPARATOR,
    );
  }

  private toCardData(id: string) {
    return [BotNamespace.LABELS, LabelsAction.CARD, id, 0].join(
      BOT_BUTTON_DATA_SEPARATOR,
    );
  }

  private toCardButton(locale: Locale, id: string) {
    return { text: locale.labelAdd.openCard, data: this.toCardData(id) };
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
