import { Injectable } from '@nestjs/common';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ScreenButton } from 'src/common/channel/types/chat-channel.interface';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import { TraitDimension } from 'src/modules/application/trait/types/trait.enums';
import { Source } from 'src/modules/application/source/types/source.enums';
import { TraitService } from 'src/modules/application/trait/trait.service';
import { TraitNameService } from 'src/modules/application/trait/trait-name/trait-name.service';
import { JobRole, Permission } from 'src/modules/application/user/types/user.enums';
import { ADMIN_MENU_DATA } from '../admin/constants/admin.constants';
import { BotSection } from '../core/bot.decorator';
import { BotNamespace } from '../core/types/bot.enums';
import type { BotContext, BotHandler, BotReply } from '../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../core/constants/bot.constants';
import { TraitAddAction } from './add/types/trait-add.enums';
import { TraitManageAction } from './manage/types/trait-manage.enums';
import { TraitNameList } from './names/types/trait-names.enums';
import {
  TRAITS_BUTTON_SCHEMA,
  TRAITS_ITEM_SEPARATOR,
  TRAITS_PAGE_SIZE,
  TRAITS_VALUE_PREFIX,
} from './constants/traits.constants';
import { TraitsAction } from './types/traits.enums';
import { TraitsView } from './traits.view';

@Injectable()
@BotSection({ access: Permission.TRAITS, namespace: BotNamespace.TRAITS })
export class TraitsHandler implements BotHandler {
  constructor(
    private readonly traitService: TraitService,
    private readonly traitNameService: TraitNameService,
    private readonly traitsView: TraitsView,
  ) {}

  async handle({ input, locale }: BotContext): Promise<BotReply> {
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }

    const button = TRAITS_BUTTON_SCHEMA.safeParse(input.data.split(BOT_BUTTON_DATA_SEPARATOR));
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
    const mappings = await this.traitService.findSourceNamePage(
      TRAITS_PAGE_SIZE,
      current * TRAITS_PAGE_SIZE,
    );

    const lines = [locale.traitList.title(total)];
    if (total === 0) {
      lines.push(locale.traitList.empty);
    } else if (pages > 1) {
      lines.push(locale.traitList.page(current + 1, pages));
    }
    const unmapped = await this.traitNameService.countUnmapped(Source.GITLAB, false);

    return {
      screen: {
        text: lines.join('\n'),
        buttons: [
          ...mappings.map((mapping) => [
            {
              text: [
                mapping.sourceName,
                this.traitsView.toValueName(locale, mapping.dimension, mapping.value),
              ].join(TRAITS_ITEM_SEPARATOR),
              data: this.traitsView.toCardData(mapping.id, current),
            },
          ]),
          ...this.traitsView.toPageButtons(locale, current, pages, (target) =>
            this.traitsView.toListData(target),
          ),
          [
            {
              text: locale.traitList.unmapped(unmapped),
              data: this.traitsView.toNamesData(TraitNameList.UNMAPPED),
            },
          ],
          [
            {
              text: locale.traitList.add,
              data: [BotNamespace.TRAIT_ADD, TraitAddAction.START].join(BOT_BUTTON_DATA_SEPARATOR),
            },
            { text: locale.traitList.menu, data: ADMIN_MENU_DATA },
          ],
        ],
      },
      dialog: null,
    };
  }

  private async showCard(locale: Locale, id: string, page: number): Promise<BotReply> {
    const back = [
      [
        {
          text: locale.traitList.backToList,
          data: this.traitsView.toListData(page),
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

    const mappings = await this.traitService.findByKey(mapping.source, mapping.sourceKey);
    const dimensions = Object.values(TraitDimension);
    const lines = [this.traitsView.toSourceName(mapping.sourceName)];
    const valueButtons: ScreenButton[][] = [];
    for (const role of [null, ...Object.values(JobRole)]) {
      const values = mappings
        .filter((item) => item.role === role)
        .sort(
          (first, second) =>
            dimensions.indexOf(first.dimension) - dimensions.indexOf(second.dimension),
        );
      if (values.length === 0) {
        continue;
      }
      lines.push(
        '',
        `${role ? locale.roles[role] : locale.traitList.everyone}:`,
        ...values.map(
          (item) =>
            `${TRAITS_VALUE_PREFIX}${this.traitsView.describe(locale, item.dimension, item.value)}`,
        ),
      );
      valueButtons.push(
        ...values.map((item) => [
          {
            text: role
              ? [
                  locale.roles[role],
                  this.traitsView.describe(locale, item.dimension, item.value),
                ].join(TRAITS_ITEM_SEPARATOR)
              : this.traitsView.describe(locale, item.dimension, item.value),
            data: this.toSectionData(BotNamespace.TRAIT_MANAGE, TraitManageAction.OPEN, item.id),
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
              data: this.toSectionData(BotNamespace.TRAIT_ADD, TraitAddAction.MORE, mapping.id),
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

  private toSectionData(namespace: BotNamespace, ...parts: string[]) {
    return [namespace, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
