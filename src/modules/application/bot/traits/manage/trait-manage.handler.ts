import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ScreenButton } from 'src/common/channel/types/chat-channel.interface';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import { TRAIT_DICTIONARY } from 'src/modules/application/trait/constants/trait.constants';
import type { TraitMapping, TraitValue } from 'src/modules/application/trait/types/trait.interface';
import { TraitService } from 'src/modules/application/trait/trait.service';
import { BotSection } from '../../core/bot.decorator';
import { BotAccess, BotNamespace } from '../../core/types/bot.enums';
import type { BotActor, BotContext, BotHandler, BotReply } from '../../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../../core/constants/bot.constants';
import { TraitsView } from '../traits.view';
import { TRAIT_MANAGE_BUTTON_SCHEMA } from './constants/trait-manage.constants';
import { TraitManageMessages } from './constants/trait-manage.messages';
import { TraitManageAction } from './types/trait-manage.enums';

@Injectable()
@BotSection({
  access: BotAccess.OWNER,
  namespace: BotNamespace.TRAIT_MANAGE,
})
export class TraitManageHandler implements BotHandler {
  private readonly logger = new Logger(TraitManageHandler.name);

  constructor(
    private readonly traitService: TraitService,
    private readonly traitsView: TraitsView,
  ) {}

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
      return this.reply(locale.traitList.notFound, [[this.traitsView.toListButton(locale)]]);
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
          this.traitsView.toSourceName(mapping.sourceName),
          this.traitsView.toWhom(locale, mapping.role),
          locale.traits.dimensions[mapping.dimension],
          this.traitsView.toValueName(locale, mapping.dimension, mapping.value),
        ),
        '',
        ...this.traitsView.describeValues(locale, mapping.dimension),
      ].join('\n'),
      [
        ...this.traitsView.toRows(
          values.map((value, index) => ({
            text: this.toValueText(locale, mapping, value),
            data: this.toData(TraitManageAction.SET, mapping.id, String(index)),
          })),
        ),
        [
          {
            text: traitManage.deleteValue,
            data: this.toData(TraitManageAction.DELETE, mapping.id),
          },
        ],
        [{ text: traitManage.back, data: this.traitsView.toCardData(mapping.id) }],
      ],
    );
  }

  private toValueText(locale: Locale, mapping: TraitMapping, value: TraitValue): string {
    const name = this.traitsView.toValueName(locale, mapping.dimension, value);
    return value === mapping.value ? locale.traitManage.selected(name) : name;
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
        return this.reply(locale.traitList.notFound, [[this.traitsView.toListButton(locale)]]);
      }
      this.log(actor, mapping, TraitManageMessages.VALUE_CHANGED, value);
    }

    return this.reply(
      locale.traitManage.changed(
        this.traitsView.toSourceName(mapping.sourceName),
        this.traitsView.toWhom(locale, mapping.role),
        this.traitsView.describe(locale, mapping.dimension, value),
      ),
      [[this.traitsView.toCardButton(locale, mapping.id)], [this.traitsView.toListButton(locale)]],
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
      this.traitsView.toSourceName(mapping.sourceName),
      this.traitsView.toWhom(locale, mapping.role),
      this.traitsView.describe(locale, mapping.dimension, mapping.value),
    );
    const [remaining] = await this.traitService.findByKey(mapping.source, mapping.sourceKey);
    return remaining
      ? this.reply(text, [
          [this.traitsView.toCardButton(locale, remaining.id)],
          [this.traitsView.toListButton(locale)],
        ])
      : this.reply([text, locale.traitManage.labelEmpty].join('\n\n'), [
          [this.traitsView.toListButton(locale)],
        ]);
  }

  private async confirmDrop(locale: Locale, mapping: TraitMapping): Promise<BotReply> {
    const mappings = await this.traitService.findByKey(mapping.source, mapping.sourceKey);
    return this.reply(
      locale.traitManage.confirmDrop(
        this.traitsView.toSourceName(mapping.sourceName),
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
            data: this.traitsView.toCardData(mapping.id),
          },
        ],
      ],
    );
  }

  private async drop(actor: BotActor, locale: Locale, mapping: TraitMapping): Promise<BotReply> {
    await this.traitService.deleteByKey(mapping.source, mapping.sourceKey);
    this.log(actor, mapping, TraitManageMessages.LABEL_DELETED);
    return this.reply(
      locale.traitManage.dropped(this.traitsView.toSourceName(mapping.sourceName)),
      [[this.traitsView.toListButton(locale)]],
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

  private reply(text: string, buttons: ScreenButton[][]): BotReply {
    return { screen: { text, buttons }, dialog: null };
  }

  private toData(...parts: string[]) {
    return [BotNamespace.TRAIT_MANAGE, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
