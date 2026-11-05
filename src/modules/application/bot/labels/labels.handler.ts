import { Injectable } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import type { ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type {
  LabelValueText,
  Locale,
} from 'src/modules/application/i18n/i18n.interface';
import { LabelDimension } from 'src/modules/application/label/label.enums';
import type { LabelMapping } from 'src/modules/application/label/label.interface';
import { LabelService } from 'src/modules/application/label/label.service';
import { JobRole, Permission } from 'src/modules/application/user/user.enums';
import { ADMIN_MENU_DATA } from '../admin/constants/admin.constants';
import { BotSection } from '../bot.decorator';
import { BotNamespace } from '../bot.enums';
import type { BotContext, BotHandler, BotReply } from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import { LabelAddAction } from '../label-add/label-add.enums';
import {
  LABELS_BUTTON_SCHEMA,
  LABELS_ITEM_SEPARATOR,
  LABELS_PAGE_SIZE,
  LABELS_VALUE_PREFIX,
} from './constants/labels.constants';
import { LabelsAction } from './labels.enums';

@Injectable()
@BotSection({ access: Permission.LABELS, namespace: BotNamespace.LABELS })
export class LabelsHandler implements BotHandler {
  constructor(private readonly labelService: LabelService) {}

  async handle({ input, locale }: BotContext): Promise<BotReply> {
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }

    const button = LABELS_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case LabelsAction.LIST:
        return this.showList(locale, button.data.page);
      case LabelsAction.CARD:
        return this.showCard(locale, button.data.id, button.data.page);
    }
  }

  private async showList(locale: Locale, page: number): Promise<BotReply> {
    const total = await this.labelService.countLabels();
    const pages = Math.max(1, Math.ceil(total / LABELS_PAGE_SIZE));
    const current = Math.min(page, pages - 1);
    const labels = await this.labelService.findLabelPage(
      LABELS_PAGE_SIZE,
      current * LABELS_PAGE_SIZE,
    );

    const lines = [locale.labelList.title(total)];
    if (total === 0) {
      lines.push(locale.labelList.empty);
    } else if (pages > 1) {
      lines.push(locale.labelList.page(current + 1, pages));
    }
    const navigation: ScreenButton[] = [];
    if (current > 0) {
      navigation.push({
        text: locale.labelList.previous,
        data: this.toData(LabelsAction.LIST, current - 1),
      });
    }
    if (current < pages - 1) {
      navigation.push({
        text: locale.labelList.next,
        data: this.toData(LabelsAction.LIST, current + 1),
      });
    }

    return {
      screen: {
        text: lines.join('\n'),
        buttons: [
          ...labels.map((mapping) => [
            {
              text: [
                mapping.label,
                this.toValueText(locale, mapping).name,
              ].join(LABELS_ITEM_SEPARATOR),
              data: this.toData(LabelsAction.CARD, mapping.id, current),
            },
          ]),
          ...(navigation.length > 0 ? [navigation] : []),
          [
            {
              text: locale.labelList.add,
              data: [BotNamespace.LABEL_ADD, LabelAddAction.START].join(
                BOT_BUTTON_DATA_SEPARATOR,
              ),
            },
            { text: locale.labelList.menu, data: ADMIN_MENU_DATA },
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
          text: locale.labelList.backToList,
          data: this.toData(LabelsAction.LIST, page),
        },
      ],
    ];
    const mapping = await this.labelService.findById(id);
    if (!mapping) {
      return {
        screen: { text: locale.labelList.notFound, buttons: back },
        dialog: null,
      };
    }

    const mappings = await this.labelService.findByKey(mapping.labelKey);
    const dimensions = Object.values(LabelDimension);
    const lines = [`**${escapeMarkdown(mapping.label)}**`];
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
        `${role ? locale.roles[role] : locale.labelList.everyone}:`,
        ...values.map(
          (item) =>
            `${LABELS_VALUE_PREFIX}${locale.labels.dimensions[item.dimension]}: ${this.toValueText(locale, item).name}`,
        ),
      );
    }
    return {
      screen: { text: lines.join('\n'), buttons: back },
      dialog: null,
    };
  }

  private toValueText(
    locale: Locale,
    { dimension, value }: Pick<LabelMapping, 'dimension' | 'value'>,
  ) {
    const texts: Record<string, LabelValueText> =
      locale.labels.values[dimension];
    return texts[value];
  }

  private toData(...parts: (string | number)[]) {
    return [BotNamespace.LABELS, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
