import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import { isValidSourceKey, toSourceKey } from 'src/common/utils/source-name.util';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import {
  TRAIT_DICTIONARY,
  TRAIT_SOURCE_NAME_MAX_LENGTH,
} from 'src/modules/application/trait/constants/trait.constants';
import { TraitDimension } from 'src/modules/application/trait/types/trait.enums';
import type { TraitMapping, TraitValue } from 'src/modules/application/trait/types/trait.interface';
import { Source } from 'src/modules/application/source/types/source.enums';
import { TraitService } from 'src/modules/application/trait/trait.service';
import { TraitNameService } from 'src/modules/application/trait/trait-name/trait-name.service';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { BotSection } from '../../core/bot.decorator';
import { DialogService } from '../../core/dialog.service';
import { BotAccess, BotNamespace } from '../../core/types/bot.enums';
import type {
  BotActor,
  BotContext,
  BotDialog,
  BotHandler,
  BotReply,
} from '../../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../../core/constants/bot.constants';
import { TraitsView } from '../traits.view';
import {
  TRAIT_ADD_BUTTON_SCHEMA,
  TRAIT_ADD_DRAFT_SCHEMA,
  TRAIT_ADD_EVERYONE,
  TRAIT_ADD_VALUE_SCHEMAS,
} from './constants/trait-add.constants';
import { TraitAddMessages } from './constants/trait-add.messages';
import { TraitAddAction, TraitAddStep } from './types/trait-add.enums';

@Injectable()
@BotSection({ access: BotAccess.OWNER, namespace: BotNamespace.TRAIT_ADD })
export class TraitAddHandler implements BotHandler {
  private readonly logger = new Logger(TraitAddHandler.name);

  constructor(
    private readonly traitService: TraitService,
    private readonly traitNameService: TraitNameService,
    private readonly traitsView: TraitsView,
    private readonly dialogService: DialogService,
  ) {}

  async handle({ actor, input, dialog, locale }: BotContext): Promise<BotReply> {
    if (input.type === ChatInputType.TEXT) {
      return this.receiveLabel(locale, input.text);
    }
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }

    const button = TRAIT_ADD_BUTTON_SCHEMA.safeParse(input.data.split(BOT_BUTTON_DATA_SEPARATOR));
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case TraitAddAction.START:
        return this.askLabel(locale);
      case TraitAddAction.MORE:
        return this.addToLabel(locale, button.data.id);
      case TraitAddAction.NAME:
        return this.mapName(locale, button.data.id);
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
            buttons: [[this.traitsView.toListButton(locale)]],
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
    if (label.length > TRAIT_SOURCE_NAME_MAX_LENGTH || !isValidSourceKey(sourceKey)) {
      return this.askLabel(locale, locale.traitAdd.invalid(TRAIT_SOURCE_NAME_MAX_LENGTH));
    }
    const [existing] = await this.traitService.findByKey(Source.GITLAB, sourceKey);
    if (existing) {
      return this.showExisting(
        locale,
        existing,
        locale.traitAdd.exists(this.traitsView.toSourceName(existing.sourceName)),
      );
    }
    return this.askRole(locale, label);
  }

  private async addToLabel(locale: Locale, id: string): Promise<BotReply> {
    const mapping = await this.traitService.findById(id);
    return mapping
      ? this.askRole(locale, mapping.sourceName)
      : this.showNotFound(locale, locale.traitList.notFound);
  }

  private async mapName(locale: Locale, id: string): Promise<BotReply> {
    const name = await this.traitNameService.findById(id);
    return name
      ? this.receiveLabel(locale, name.sourceName)
      : this.showNotFound(locale, locale.traitNames.notFound);
  }

  private showNotFound(locale: Locale, text: string): BotReply {
    return { screen: { text, buttons: [[this.traitsView.toListButton(locale)]] }, dialog: null };
  }

  private askRole(locale: Locale, label: string): BotReply {
    return {
      screen: {
        text: locale.traitAdd.forWhom(this.traitsView.toSourceName(label)),
        buttons: [
          [
            {
              text: locale.traitAdd.everyone,
              data: this.toData(TraitAddAction.ROLE, TRAIT_ADD_EVERYONE),
            },
          ],
          ...this.traitsView.toRows(
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

  private chooseRole(locale: Locale, dialog: BotDialog | null, role: JobRole | null): BotReply {
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

  private askDimension(locale: Locale, label: string, role: JobRole | null): BotReply {
    return {
      screen: {
        text: locale.traitAdd.chooseDimension(
          this.traitsView.toSourceName(label),
          this.traitsView.toWhom(locale, role),
        ),
        buttons: [
          ...this.traitsView.toRows(
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
            this.traitsView.toSourceName(label),
            this.traitsView.toWhom(locale, role),
            locale.traits.dimensions[dimension],
          ),
          '',
          ...this.traitsView.describeValues(locale, dimension),
        ].join('\n'),
        buttons: [
          ...this.traitsView.toRows(
            values.map((value) => ({
              text: this.traitsView.toValueName(locale, dimension, value),
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
      const [existing] = await this.traitService.findByKey(Source.GITLAB, toSourceKey(label));
      return existing
        ? this.showExisting(
            locale,
            existing,
            locale.traitAdd.alreadySet(this.traitsView.toSourceName(existing.sourceName)),
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
          this.traitsView.toSourceName(mapping.sourceName),
          this.traitsView.toWhom(locale, role),
          this.traitsView.describe(locale, dimension, mapping.value),
        ),
        buttons: [
          [this.traitsView.toCardButton(locale, mapping.id)],
          [
            {
              text: locale.traitAdd.addMore,
              data: this.toData(TraitAddAction.START),
            },
          ],
          [this.traitsView.toListButton(locale)],
        ],
      },
      dialog: null,
    };
  }

  private showExisting(locale: Locale, mapping: TraitMapping, text: string): BotReply {
    return {
      screen: {
        text,
        buttons: [
          [this.traitsView.toCardButton(locale, mapping.id)],
          [this.traitsView.toListButton(locale)],
        ],
      },
      dialog: null,
    };
  }

  private readDraft(dialog: BotDialog | null, step: string) {
    return this.dialogService.readDraft(
      dialog,
      BotNamespace.TRAIT_ADD,
      TRAIT_ADD_DRAFT_SCHEMA,
      step,
    );
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
}
