import { Injectable } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import type { ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type {
  TraitValueText,
  Locale,
} from 'src/modules/application/i18n/i18n.interface';
import { TraitDimension } from 'src/modules/application/trait/trait.enums';
import type { TraitMapping } from 'src/modules/application/trait/trait.interface';
import { TraitService } from 'src/modules/application/trait/trait.service';
import { JobRole, Permission } from 'src/modules/application/user/user.enums';
import { ADMIN_MENU_DATA } from '../admin/constants/admin.constants';
import { BotSection } from '../bot.decorator';
import { BotNamespace } from '../bot.enums';
import type { BotContext, BotHandler, BotReply } from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import { TraitAddAction } from '../trait-add/trait-add.enums';
import { TraitManageAction } from '../trait-manage/trait-manage.enums';
import {
  TRAITS_BUTTON_SCHEMA,
  TRAITS_ITEM_SEPARATOR,
  TRAITS_PAGE_SIZE,
  TRAITS_VALUE_PREFIX,
} from './constants/traits.constants';
import { TraitsAction } from './traits.enums';

@Injectable()
@BotSection({ access: Permission.TRAITS, namespace: BotNamespace.TRAITS })
export class TraitsHandler implements BotHandler {
  constructor(private readonly traitService: TraitService) {}

  async handle({ input, locale }: BotContext): Promise<BotReply> {
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }

    const button = TRAITS_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case TraitsAction.LIST:
        return this.showList(locale, button.data.page);
      case TraitsAction.CARD:
        return this.showCard(locale, button.data.id, button.data.page);
    }
  }

  private async showList(locale: Locale, page: number): Promise<BotReply> {
    const total = await this.traitService.countSourceNames();
    const pages = Math.max(1, Math.ceil(total / TRAITS_PAGE_SIZE));
    const current = Math.min(page, pages - 1);
    const labels = await this.traitService.findSourceNamePage(
      TRAITS_PAGE_SIZE,
      current * TRAITS_PAGE_SIZE,
    );

    const lines = [locale.traitList.title(total)];
    if (total === 0) {
      lines.push(locale.traitList.empty);
    } else if (pages > 1) {
      lines.push(locale.traitList.page(current + 1, pages));
    }
    const navigation: ScreenButton[] = [];
    if (current > 0) {
      navigation.push({
        text: locale.traitList.previous,
        data: this.toData(TraitsAction.LIST, current - 1),
      });
    }
    if (current < pages - 1) {
      navigation.push({
        text: locale.traitList.next,
        data: this.toData(TraitsAction.LIST, current + 1),
      });
    }

    return {
      screen: {
        text: lines.join('\n'),
        buttons: [
          ...labels.map((mapping) => [
            {
              text: [
                mapping.sourceName,
                this.toValueText(locale, mapping).name,
              ].join(TRAITS_ITEM_SEPARATOR),
              data: this.toData(TraitsAction.CARD, mapping.id, current),
            },
          ]),
          ...(navigation.length > 0 ? [navigation] : []),
          [
            {
              text: locale.traitList.add,
              data: [BotNamespace.TRAIT_ADD, TraitAddAction.START].join(
                BOT_BUTTON_DATA_SEPARATOR,
              ),
            },
            { text: locale.traitList.menu, data: ADMIN_MENU_DATA },
          ],
        ],
      },
      dialog: null,
    };
  }

  private async showCard(
    locale: Locale,
    id: string,
    page: number,
  ): Promise<BotReply> {
    const back = [
      [
        {
          text: locale.traitList.backToList,
          data: this.toData(TraitsAction.LIST, page),
        },
      ],
    ];
    const mapping = await this.traitService.findById(id);
    if (!mapping) {
      return {
        screen: { text: locale.traitList.notFound, buttons: back },
        dialog: null,
      };
    }

    const mappings = await this.traitService.findByKey(
      mapping.source,
      mapping.sourceKey,
    );
    const dimensions = Object.values(TraitDimension);
    const lines = [`**${escapeMarkdown(mapping.sourceName)}**`];
    const valueButtons: ScreenButton[][] = [];
    for (const role of [null, ...Object.values(JobRole)]) {
      const values = mappings
        .filter((item) => item.role === role)
        .sort(
          (first, second) =>
            dimensions.indexOf(first.dimension) -
            dimensions.indexOf(second.dimension),
        );
      if (values.length === 0) {
        continue;
      }
      lines.push(
        '',
        `${role ? locale.roles[role] : locale.traitList.everyone}:`,
        ...values.map(
          (item) => `${TRAITS_VALUE_PREFIX}${this.describe(locale, item)}`,
        ),
      );
      valueButtons.push(
        ...values.map((item) => [
          {
            text: role
              ? [locale.roles[role], this.describe(locale, item)].join(
                  TRAITS_ITEM_SEPARATOR,
                )
              : this.describe(locale, item),
            data: this.toSectionData(
              BotNamespace.TRAIT_MANAGE,
              TraitManageAction.OPEN,
              item.id,
            ),
          },
        ]),
      );
    }
    return {
      screen: {
        text: lines.join('\n'),
        buttons: [
          ...valueButtons,
          [
            {
              text: locale.traitList.addValue,
              data: this.toSectionData(
                BotNamespace.TRAIT_ADD,
                TraitAddAction.MORE,
                mapping.id,
              ),
            },
          ],
          [
            {
              text: locale.traitList.drop,
              data: this.toSectionData(
                BotNamespace.TRAIT_MANAGE,
                TraitManageAction.DROP,
                mapping.id,
              ),
            },
          ],
          ...back,
        ],
      },
      dialog: null,
    };
  }

  private describe(
    locale: Locale,
    item: Pick<TraitMapping, 'dimension' | 'value'>,
  ) {
    return `${locale.traits.dimensions[item.dimension]}: ${this.toValueText(locale, item).name}`;
  }

  private toSectionData(namespace: BotNamespace, ...parts: string[]) {
    return [namespace, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }

  private toValueText(
    locale: Locale,
    { dimension, value }: Pick<TraitMapping, 'dimension' | 'value'>,
  ) {
    const texts: Record<string, TraitValueText> =
      locale.traits.values[dimension];
    return texts[value];
  }

  private toData(...parts: (string | number)[]) {
    return [BotNamespace.TRAITS, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
