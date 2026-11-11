import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatChannel } from 'src/common/channel/types/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { Permission } from 'src/modules/application/user/types/user.enums';
import type { User } from 'src/modules/application/user/types/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotNamespace } from '../types/bot.enums';
import type { BotActor, BotContext, BotHandler, BotReply } from '../types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR, BOT_CHANNELS } from '../constants/bot.constants';
import { EmployeesAction } from '../employees/types/employees.enums';
import { MenuService } from '../menu/menu.service';
import {
  EMPLOYEE_BIND_BUTTON_SCHEMA,
  EMPLOYEE_BIND_DRAFT_SCHEMA,
} from './constants/employee-bind.constants';
import { EmployeeBindMessages } from './constants/employee-bind.messages';
import { EmployeeBindAction, EmployeeBindStep } from './types/employee-bind.enums';

@Injectable()
@BotSection({ access: Permission.USERS, namespace: BotNamespace.EMPLOYEE_BIND })
export class EmployeeBindHandler implements BotHandler {
  private readonly logger = new Logger(EmployeeBindHandler.name);

  constructor(
    private readonly userService: UserService,
    private readonly channelService: ChannelService,
    private readonly menuService: MenuService,
    @Inject(BOT_CHANNELS) private readonly channels: ChatChannel[],
  ) {}

  async handle({ actor, input, dialog, locale }: BotContext): Promise<BotReply> {
    if (input.type === ChatInputType.TEXT || input.type === ChatInputType.PICKED_USER) {
      const draft = EMPLOYEE_BIND_DRAFT_SCHEMA.safeParse(dialog?.data);
      if (dialog?.step !== EmployeeBindStep.ID || !draft.success) {
        return { screen: { text: locale.bot.expired }, dialog: null };
      }
      const { userId, channel } = draft.data;
      if (input.type === ChatInputType.PICKED_USER && channel !== actor.channel) {
        return this.askAgain(locale, userId, channel, this.toInvalidText(locale, channel));
      }
      return this.bind(
        actor,
        locale,
        userId,
        channel,
        input.type === ChatInputType.TEXT ? input.text.trim() : input.externalId,
      );
    }
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }

    const button = EMPLOYEE_BIND_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success || !this.findChannel(button.data.channel)) {
      return { screen: { text: locale.bot.expired } };
    }
    const { action, userId, channel } = button.data;
    switch (action) {
      case EmployeeBindAction.START:
        return this.askId(actor, locale, userId, channel, false);
      case EmployeeBindAction.PICK:
        return this.askId(actor, locale, userId, channel, channel === actor.channel);
      case EmployeeBindAction.CANCEL:
        return {
          screen: {
            text: locale.employeeBind.cancelled,
            buttons: [[this.toCardButton(locale, userId)]],
          },
          dialog: null,
        };
    }
  }

  private async askId(
    actor: BotActor,
    locale: Locale,
    userId: string,
    channel: Channel,
    isPicker: boolean,
  ): Promise<BotReply> {
    const { user, isBound } = await this.findTarget(userId, channel);
    if (!user || isBound) {
      return this.refuse(locale, user, channel);
    }

    const channelName = locale.channels[channel];
    const name = escapeMarkdown(user.displayName);
    const cancel = [this.toCancelButton(locale, userId, channel)];
    return {
      screen: isPicker
        ? {
            text: locale.employeeBind.pickPrompt[channel],
            userPicker: { text: locale.employeeBind.pickButton },
          }
        : channel === actor.channel
          ? {
              text: [
                locale.employeeBind.prompt(channelName, name),
                locale.employeeBind.idHint[channel],
              ].join('\n'),
              buttons: [
                [
                  {
                    text: locale.employeeBind.pick(channelName),
                    data: this.toBindData(EmployeeBindAction.PICK, userId, channel),
                  },
                ],
                cancel,
              ],
            }
          : {
              text: [
                locale.employeeBind.promptId(channelName, name),
                locale.employeeBind.idHint[channel],
              ].join('\n'),
              buttons: [cancel],
            },
      dialog: {
        namespace: BotNamespace.EMPLOYEE_BIND,
        step: EmployeeBindStep.ID,
        data: { userId, channel },
      },
    };
  }

  private async bind(
    actor: BotActor,
    locale: Locale,
    userId: string,
    channel: Channel,
    externalId: string,
  ): Promise<BotReply> {
    if (!this.findChannel(channel)?.isUserId(externalId)) {
      return this.askAgain(locale, userId, channel, this.toInvalidText(locale, channel));
    }
    const taken = await this.userService.findOneByChannel(channel, externalId);
    if (taken) {
      return this.askAgain(
        locale,
        userId,
        channel,
        locale.employeeBind.taken(escapeMarkdown(taken.user.displayName)),
      );
    }
    const { user, isBound } = await this.findTarget(userId, channel);
    if (!user || isBound) {
      return this.refuse(locale, user, channel);
    }

    const bound = await this.userService.bindChannel(user.id, channel, externalId);
    await this.menuService.syncEmployee(user, [bound]);
    this.logger.log(
      { userId: user.id, channel, actorId: actor.user?.id ?? BotAccess.OWNER },
      EmployeeBindMessages.CHANNEL_BOUND,
    );
    return {
      screen: {
        text: [
          locale.employeeBind.bound(locale.channels[channel], escapeMarkdown(user.displayName)),
          locale.employeeBind.hint[channel],
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

  private async findTarget(userId: string, channel: Channel) {
    const user = await this.userService.findById(userId);
    const channels = user ? await this.channelService.findByUser(user.id) : [];
    return {
      user,
      isBound: channels.some((item) => item.channel === channel),
    };
  }

  private refuse(locale: Locale, user: User | null, channel: Channel): BotReply {
    return {
      screen: user
        ? {
            text: locale.employeeBind.alreadyBound(locale.channels[channel]),
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

  private askAgain(locale: Locale, userId: string, channel: Channel, text: string): BotReply {
    return {
      screen: { text, buttons: [[this.toCancelButton(locale, userId, channel)]] },
    };
  }

  private toInvalidText(locale: Locale, channel: Channel) {
    return [
      locale.employeeBind.invalid(locale.channels[channel]),
      locale.employeeBind.idHint[channel],
    ].join(' ');
  }

  private findChannel(channel: Channel) {
    return this.channels.find((item) => item.channel === channel);
  }

  private toCancelButton(locale: Locale, userId: string, channel: Channel) {
    return {
      text: locale.employeeBind.cancel,
      data: this.toBindData(EmployeeBindAction.CANCEL, userId, channel),
    };
  }

  private toBindData(action: EmployeeBindAction, userId: string, channel: Channel) {
    return [BotNamespace.EMPLOYEE_BIND, action, userId, channel].join(BOT_BUTTON_DATA_SEPARATOR);
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
