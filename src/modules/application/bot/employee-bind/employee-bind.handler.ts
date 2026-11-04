import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatChannel } from 'src/common/interfaces/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { Permission } from 'src/modules/application/user/user.enums';
import type { User } from 'src/modules/application/user/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotNamespace } from '../bot.enums';
import type {
  BotActor,
  BotContext,
  BotHandler,
  BotReply,
} from '../bot.interface';
import {
  BOT_BUTTON_DATA_SEPARATOR,
  BOT_CHANNELS,
} from '../constants/bot.constants';
import { BotMessages } from '../constants/bot.messages';
import { EmployeesAction } from '../employees/employees.enums';
import {
  EMPLOYEE_BIND_BUTTON_SCHEMA,
  EMPLOYEE_BIND_DRAFT_SCHEMA,
} from './constants/employee-bind.constants';
import { EmployeeBindMessages } from './constants/employee-bind.messages';
import { EmployeeBindAction, EmployeeBindStep } from './employee-bind.enums';

@Injectable()
@BotSection({ access: Permission.USERS, namespace: BotNamespace.EMPLOYEE_BIND })
export class EmployeeBindHandler implements BotHandler {
  private readonly logger = new Logger(EmployeeBindHandler.name);

  constructor(
    private readonly userService: UserService,
    private readonly channelService: ChannelService,
    @Inject(BOT_CHANNELS) private readonly channels: ChatChannel[],
  ) {}

  async handle({
    actor,
    input,
    dialog,
    locale,
  }: BotContext): Promise<BotReply> {
    if (input.type === ChatInputType.TEXT) {
      const draft = EMPLOYEE_BIND_DRAFT_SCHEMA.safeParse(dialog?.data);
      if (dialog?.step !== EmployeeBindStep.ID || !draft.success) {
        return { screen: { text: locale.bot.expired }, dialog: null };
      }
      return this.bind(actor, locale, draft.data.userId, input.text);
    }
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }

    const button = EMPLOYEE_BIND_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case EmployeeBindAction.START:
        return this.askId(actor, locale, button.data.userId);
      case EmployeeBindAction.CANCEL:
        return {
          screen: {
            text: locale.employeeBind.cancelled,
            buttons: [[this.toCardButton(locale, button.data.userId)]],
          },
          dialog: null,
        };
    }
  }

  private async askId(
    actor: BotActor,
    locale: Locale,
    userId: string,
  ): Promise<BotReply> {
    const { user, isBound } = await this.findTarget(actor, userId);
    if (!user || isBound) {
      return this.refuse(actor, locale, user);
    }

    return {
      screen: {
        text: locale.employeeBind.prompt(
          locale.channels[actor.channel],
          escapeMarkdown(user.displayName),
        ),
        buttons: [[this.toCancelButton(locale, userId)]],
      },
      dialog: {
        namespace: BotNamespace.EMPLOYEE_BIND,
        step: EmployeeBindStep.ID,
        data: { userId },
      },
    };
  }

  private async bind(
    actor: BotActor,
    locale: Locale,
    userId: string,
    text: string,
  ): Promise<BotReply> {
    const channelName = locale.channels[actor.channel];
    const externalId = text.trim();
    if (!this.getChannel(actor).isUserId(externalId)) {
      return this.askAgain(
        locale,
        userId,
        locale.employeeBind.invalid(channelName),
      );
    }
    const taken = await this.userService.findOneByChannel(
      actor.channel,
      externalId,
    );
    if (taken) {
      return this.askAgain(
        locale,
        userId,
        locale.employeeBind.taken(escapeMarkdown(taken.user.displayName)),
      );
    }
    const { user, isBound } = await this.findTarget(actor, userId);
    if (!user || isBound) {
      return this.refuse(actor, locale, user);
    }

    await this.userService.bindChannel(user.id, actor.channel, externalId);
    this.logger.log(
      { userId: user.id, actorId: actor.user?.id ?? BotAccess.OWNER },
      EmployeeBindMessages.CHANNEL_BOUND,
    );
    return {
      screen: {
        text: [
          locale.employeeBind.bound(
            channelName,
            escapeMarkdown(user.displayName),
          ),
          locale.employeeBind.hint,
        ].join('\n\n'),
        buttons: [
          [this.toCardButton(locale, user.id)],
          [
            {
              text: locale.employees.backToList,
              data: this.toEmployeesData(EmployeesAction.LIST, 0),
            },
          ],
        ],
      },
      dialog: null,
    };
  }

  private async findTarget(actor: BotActor, userId: string) {
    const user = await this.userService.findById(userId);
    const channels = user ? await this.channelService.findByUser(user.id) : [];
    return {
      user,
      isBound: channels.some((channel) => channel.channel === actor.channel),
    };
  }

  private refuse(actor: BotActor, locale: Locale, user: User | null): BotReply {
    return {
      screen: user
        ? {
            text: locale.employeeBind.alreadyBound(
              locale.channels[actor.channel],
            ),
            buttons: [[this.toCardButton(locale, user.id)]],
          }
        : {
            text: locale.employees.notFound,
            buttons: [
              [
                {
                  text: locale.employees.backToList,
                  data: this.toEmployeesData(EmployeesAction.LIST, 0),
                },
              ],
            ],
          },
      dialog: null,
    };
  }

  private askAgain(locale: Locale, userId: string, text: string): BotReply {
    return {
      screen: { text, buttons: [[this.toCancelButton(locale, userId)]] },
    };
  }

  private getChannel(actor: BotActor) {
    const channel = this.channels.find(
      (item) => item.channel === actor.channel,
    );
    if (!channel) {
      throw new Error(
        `${BotMessages.CHANNEL_NOT_REGISTERED}: ${actor.channel}`,
      );
    }
    return channel;
  }

  private toCancelButton(locale: Locale, userId: string) {
    return {
      text: locale.employeeBind.cancel,
      data: [
        BotNamespace.EMPLOYEE_BIND,
        EmployeeBindAction.CANCEL,
        userId,
      ].join(BOT_BUTTON_DATA_SEPARATOR),
    };
  }

  private toCardButton(locale: Locale, userId: string) {
    return {
      text: locale.employeeAdd.openCard,
      data: this.toEmployeesData(EmployeesAction.CARD, userId, 0),
    };
  }

  private toEmployeesData(...parts: (string | number)[]) {
    return [BotNamespace.EMPLOYEES, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
