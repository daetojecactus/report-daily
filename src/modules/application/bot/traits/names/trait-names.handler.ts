import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ScreenButton } from 'src/common/channel/types/chat-channel.interface';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import { Source } from 'src/modules/application/source/types/source.enums';
import { TRAIT_NAME_SEEN_DAYS } from 'src/modules/application/trait/constants/trait.constants';
import { TraitNameService } from 'src/modules/application/trait/trait-name/trait-name.service';
import { Permission } from 'src/modules/application/user/types/user.enums';
import { BotSection } from '../../core/bot.decorator';
import { BotAccess, BotNamespace } from '../../core/types/bot.enums';
import type { BotActor, BotContext, BotHandler, BotReply } from '../../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../../core/constants/bot.constants';
import { TraitAddAction } from '../add/types/trait-add.enums';
import { TraitsView } from '../traits.view';
import {
  TRAIT_NAMES_BUTTON_SCHEMA,
  TRAIT_NAMES_PAGE_SIZE,
} from './constants/trait-names.constants';
import { TraitNamesMessages } from './constants/trait-names.messages';
import { TraitNameList, TraitNamesAction } from './types/trait-names.enums';

@Injectable()
@BotSection({ access: Permission.TRAITS, namespace: BotNamespace.TRAIT_NAMES })
export class TraitNamesHandler implements BotHandler {
  private readonly logger = new Logger(TraitNamesHandler.name);

  constructor(
    private readonly traitNameService: TraitNameService,
    private readonly traitsView: TraitsView,
  ) {}

  async handle({ actor, input, locale }: BotContext): Promise<BotReply> {
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }

    const button = TRAIT_NAMES_BUTTON_SCHEMA.safeParse(input.data.split(BOT_BUTTON_DATA_SEPARATOR));
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case TraitNamesAction.LIST:
        return this.showList(locale, button.data.list, button.data.page);
      case TraitNamesAction.CARD:
        return this.showCard(locale, button.data.id, button.data.page);
      case TraitNamesAction.IGNORE:
      case TraitNamesAction.RESTORE:
        return this.setIgnored(
          actor,
          locale,
          button.data.id,
          button.data.action === TraitNamesAction.IGNORE,
          button.data.page,
        );
    }
  }

  private async showList(
    locale: Locale,
    list: TraitNameList,
    page: number,
    notice?: string,
  ): Promise<BotReply> {
    const ignored = list === TraitNameList.IGNORED;
    const [total, ignoredTotal] = await Promise.all([
      this.traitNameService.countUnmapped(Source.GITLAB, ignored),
      ignored ? 0 : this.traitNameService.countUnmapped(Source.GITLAB, true),
    ]);
    const pages = Math.max(1, Math.ceil(total / TRAIT_NAMES_PAGE_SIZE));
    const current = Math.min(page, pages - 1);
    const names = await this.traitNameService.findUnmappedPage(
      Source.GITLAB,
      ignored,
      TRAIT_NAMES_PAGE_SIZE,
      current * TRAIT_NAMES_PAGE_SIZE,
    );

    const texts = locale.traitNames;
    const lines = [
      ...(notice ? [notice, ''] : []),
      ignored ? texts.ignoredTitle(total) : texts.title(total),
      total === 0
        ? ignored
          ? texts.ignoredEmpty
          : texts.empty(TRAIT_NAME_SEEN_DAYS)
        : ignored
          ? texts.ignoredHint
          : texts.hint(TRAIT_NAME_SEEN_DAYS),
      ...(pages > 1 ? [locale.traitList.page(current + 1, pages)] : []),
    ];
    const other: ScreenButton[] = ignored
      ? [{ text: texts.showUnmapped, data: this.traitsView.toNamesData(TraitNameList.UNMAPPED) }]
      : ignoredTotal > 0
        ? [
            {
              text: texts.showIgnored(ignoredTotal),
              data: this.traitsView.toNamesData(TraitNameList.IGNORED),
            },
          ]
        : [];
    return this.reply(lines.join('\n'), [
      ...names.map((name) => [
        { text: name.sourceName, data: this.toData(TraitNamesAction.CARD, name.id, current) },
      ]),
      ...this.traitsView.toPageButtons(locale, current, pages, (target) =>
        this.traitsView.toNamesData(list, target),
      ),
      [...other, { text: texts.backToTraits, data: this.traitsView.toListData() }],
    ]);
  }

  private async showCard(locale: Locale, id: string, page: number): Promise<BotReply> {
    const name = await this.traitNameService.findById(id);
    if (!name) {
      return this.showNotFound(locale);
    }
    const texts = locale.traitNames;
    return this.reply(
      [
        this.traitsView.toSourceName(name.sourceName),
        name.ignored ? texts.ignoredCard : texts.card,
      ].join('\n'),
      [
        [
          {
            text: texts.map,
            data: [BotNamespace.TRAIT_ADD, TraitAddAction.NAME, name.id].join(
              BOT_BUTTON_DATA_SEPARATOR,
            ),
          },
          name.ignored
            ? { text: texts.restore, data: this.toData(TraitNamesAction.RESTORE, name.id, page) }
            : { text: texts.ignore, data: this.toData(TraitNamesAction.IGNORE, name.id, page) },
        ],
        [
          {
            text: texts.back,
            data: this.traitsView.toNamesData(
              name.ignored ? TraitNameList.IGNORED : TraitNameList.UNMAPPED,
              page,
            ),
          },
        ],
      ],
    );
  }

  private async setIgnored(
    actor: BotActor,
    locale: Locale,
    id: string,
    ignored: boolean,
    page: number,
  ): Promise<BotReply> {
    const name = await this.traitNameService.setIgnored(id, ignored);
    if (!name) {
      return this.showNotFound(locale);
    }
    this.logger.log(
      {
        source: name.source,
        sourceKey: name.sourceKey,
        actorId: actor.user?.id ?? BotAccess.OWNER,
      },
      ignored ? TraitNamesMessages.NAME_IGNORED : TraitNamesMessages.NAME_RESTORED,
    );
    const label = this.traitsView.toSourceName(name.sourceName);
    return this.showList(
      locale,
      ignored ? TraitNameList.UNMAPPED : TraitNameList.IGNORED,
      page,
      ignored ? locale.traitNames.ignored(label) : locale.traitNames.restored(label),
    );
  }

  private showNotFound(locale: Locale) {
    return this.reply(locale.traitNames.notFound, [
      [{ text: locale.traitNames.backToTraits, data: this.traitsView.toListData() }],
    ]);
  }

  private reply(text: string, buttons: ScreenButton[][]): BotReply {
    return { screen: { text, buttons }, dialog: null };
  }

  private toData(...parts: (string | number)[]) {
    return [BotNamespace.TRAIT_NAMES, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
