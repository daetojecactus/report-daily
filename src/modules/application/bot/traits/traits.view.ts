import { Injectable } from '@nestjs/common';
import type { ScreenButton } from 'src/common/channel/types/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale, TraitValueText } from 'src/modules/application/i18n/types/i18n.interface';
import { TRAIT_DICTIONARY } from 'src/modules/application/trait/constants/trait.constants';
import type { TraitDimension } from 'src/modules/application/trait/types/trait.enums';
import type { TraitValue } from 'src/modules/application/trait/types/trait.interface';
import type { JobRole } from 'src/modules/application/user/types/user.enums';
import { BotNamespace } from '../types/bot.enums';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import type { TraitNameList } from '../trait-names/types/trait-names.enums';
import { TraitNamesAction } from '../trait-names/types/trait-names.enums';
import { TRAITS_BUTTONS_PER_ROW } from './constants/traits.constants';
import { TraitsAction } from './types/traits.enums';

@Injectable()
export class TraitsView {
  toSourceName(sourceName: string) {
    return `**${escapeMarkdown(sourceName)}**`;
  }

  toWhom(locale: Locale, role: JobRole | null) {
    return role ? locale.traitAdd.forRole(locale.roles[role]) : locale.traitAdd.forEveryone;
  }

  toValueName(locale: Locale, dimension: TraitDimension, value: TraitValue) {
    return this.toValueText(locale, dimension, value).name;
  }

  describe(locale: Locale, dimension: TraitDimension, value: TraitValue) {
    return `${locale.traits.dimensions[dimension]}: ${this.toValueName(locale, dimension, value)}`;
  }

  describeValues(locale: Locale, dimension: TraitDimension) {
    const values: readonly TraitValue[] = TRAIT_DICTIONARY[dimension];
    return values.map((value) => {
      const { name, description } = this.toValueText(locale, dimension, value);
      return `**${name}** — ${description}`;
    });
  }

  toRows(buttons: ScreenButton[]) {
    const rows: ScreenButton[][] = [];
    for (let index = 0; index < buttons.length; index += TRAITS_BUTTONS_PER_ROW) {
      rows.push(buttons.slice(index, index + TRAITS_BUTTONS_PER_ROW));
    }
    return rows;
  }

  toListData(page = 0) {
    return [BotNamespace.TRAITS, TraitsAction.LIST, page].join(BOT_BUTTON_DATA_SEPARATOR);
  }

  toCardData(id: string, page = 0) {
    return [BotNamespace.TRAITS, TraitsAction.CARD, id, page].join(BOT_BUTTON_DATA_SEPARATOR);
  }

  toNamesData(list: TraitNameList, page = 0) {
    return [BotNamespace.TRAIT_NAMES, TraitNamesAction.LIST, list, page].join(
      BOT_BUTTON_DATA_SEPARATOR,
    );
  }

  toPageButtons(locale: Locale, current: number, pages: number, toData: (page: number) => string) {
    const buttons: ScreenButton[] = [];
    if (current > 0) {
      buttons.push({ text: locale.traitList.previous, data: toData(current - 1) });
    }
    if (current < pages - 1) {
      buttons.push({ text: locale.traitList.next, data: toData(current + 1) });
    }
    return buttons.length > 0 ? [buttons] : [];
  }

  toListButton(locale: Locale): ScreenButton {
    return { text: locale.traitList.backToList, data: this.toListData() };
  }

  toCardButton(locale: Locale, id: string): ScreenButton {
    return { text: locale.traitAdd.openCard, data: this.toCardData(id) };
  }

  private toValueText(locale: Locale, dimension: TraitDimension, value: TraitValue) {
    const texts: Record<string, TraitValueText> = locale.traits.values[dimension];
    return texts[value];
  }
}
