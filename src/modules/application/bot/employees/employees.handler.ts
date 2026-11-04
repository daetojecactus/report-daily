import { Injectable } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import type { ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import {
  Permission,
  UserStatus,
} from 'src/modules/application/user/user.enums';
import type { User } from 'src/modules/application/user/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import { ADMIN_MENU_DATA } from '../admin/constants/admin.constants';
import { BotSection } from '../bot.decorator';
import { BotNamespace } from '../bot.enums';
import type {
  BotActor,
  BotContext,
  BotHandler,
  BotReply,
} from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import {
  EMPLOYEES_BUTTON_SCHEMA,
  EMPLOYEES_ITEM_SEPARATOR,
  EMPLOYEES_PAGE_SIZE,
  EMPLOYEES_QUERY_MAX_LENGTH,
  EMPLOYEES_SEARCH_LIMIT,
  EMPLOYEES_USERNAME_PREFIX,
} from './constants/employees.constants';
import { EmployeeAddAction } from '../employee-add/employee-add.enums';
import { AccessService } from '../access/access.service';
import { EmployeeBindAction } from '../employee-bind/employee-bind.enums';
import { EmployeeManageAction } from '../employee-manage/employee-manage.enums';
import { EmployeesAction, EmployeesStep } from './employees.enums';

@Injectable()
@BotSection({ access: Permission.USERS, namespace: BotNamespace.EMPLOYEES })
export class EmployeesHandler implements BotHandler {
  constructor(
    private readonly userService: UserService,
    private readonly channelService: ChannelService,
    private readonly accessService: AccessService,
  ) {}

  async handle({
    actor,
    input,
    dialog,
    locale,
  }: BotContext): Promise<BotReply> {
    if (
      input.type === ChatInputType.TEXT &&
      dialog?.step === EmployeesStep.SEARCH
    ) {
      return this.search(locale, input.text);
    }
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }

    const button = EMPLOYEES_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case EmployeesAction.LIST:
        return this.showList(locale, button.data.page);
      case EmployeesAction.CARD:
        return this.showCard(actor, locale, button.data.id, button.data.page);
      case EmployeesAction.SEARCH:
        return this.askQuery(locale);
    }
  }

  private async showList(locale: Locale, page: number): Promise<BotReply> {
    const total = await this.userService.count();
    const pages = Math.max(1, Math.ceil(total / EMPLOYEES_PAGE_SIZE));
    const current = Math.min(page, pages - 1);
    const employees = await this.userService.findPage(
      EMPLOYEES_PAGE_SIZE,
      current * EMPLOYEES_PAGE_SIZE,
    );

    const lines = [locale.employees.title(total)];
    if (total === 0) {
      lines.push(locale.employees.empty);
    } else if (pages > 1) {
      lines.push(locale.employees.page(current + 1, pages));
    }
    const navigation: ScreenButton[] = [];
    if (current > 0) {
      navigation.push({
        text: locale.employees.previous,
        data: this.toData(EmployeesAction.LIST, current - 1),
      });
    }
    if (current < pages - 1) {
      navigation.push({
        text: locale.employees.next,
        data: this.toData(EmployeesAction.LIST, current + 1),
      });
    }

    return {
      screen: {
        text: lines.join('\n'),
        buttons: [
          ...employees.map((user) => [
            this.toCardButton(locale, user, current),
          ]),
          ...(navigation.length > 0 ? [navigation] : []),
          [
            {
              text: locale.employees.search,
              data: this.toData(EmployeesAction.SEARCH),
            },
            {
              text: locale.employees.add,
              data: [BotNamespace.EMPLOYEE_ADD, EmployeeAddAction.START].join(
                BOT_BUTTON_DATA_SEPARATOR,
              ),
            },
            { text: locale.employees.menu, data: ADMIN_MENU_DATA },
          ],
        ],
      },
      dialog: null,
    };
  }

  private async showCard(
    actor: BotActor,
    locale: Locale,
    id: string,
    page: number,
  ): Promise<BotReply> {
    const back = [
      [
        {
          text: locale.employees.backToList,
          data: this.toData(EmployeesAction.LIST, page),
        },
      ],
    ];
    const user = await this.userService.findById(id);
    if (!user) {
      return {
        screen: { text: locale.employees.notFound, buttons: back },
        dialog: null,
      };
    }

    const { card } = locale.employees;
    const channels = await this.channelService.findByUser(user.id);
    const lines = [
      `**${escapeMarkdown(user.displayName)}**`,
      `${card.gitlab}: @${escapeMarkdown(user.gitlabUsername)}`,
      `${card.role}: ${locale.roles[user.role]}`,
      `${card.gender}: ${locale.genders[user.gender]}`,
      `${card.status}: ${locale.statuses[user.status]}`,
    ];
    if (channels.length === 0) {
      lines.push(`${card.channels}: ${card.noChannels}`);
    }
    for (const channel of channels) {
      lines.push(
        `${locale.channels[channel.channel]}: ${channel.reachable ? card.reachable : card.unreachable}`,
      );
    }
    if (user.permissions.length > 0) {
      lines.push(
        `${card.permissions}: ${user.permissions
          .map((permission) => locale.permissions[permission])
          .join(', ')}`,
      );
    }

    const actions: ScreenButton[][] = [];
    if (!channels.some((channel) => channel.channel === actor.channel)) {
      actions.push([
        {
          text: locale.employees.bind(locale.channels[actor.channel]),
          data: this.toSectionData(
            BotNamespace.EMPLOYEE_BIND,
            EmployeeBindAction.START,
            user.id,
          ),
        },
      ]);
    }
    actions.push([
      {
        text: locale.employeeManage.changeRole,
        data: this.toSectionData(
          BotNamespace.EMPLOYEE_MANAGE,
          EmployeeManageAction.ROLE,
          user.id,
        ),
      },
    ]);
    if (this.accessService.canManage(actor, user)) {
      const isBlocked = user.status === UserStatus.BLOCKED;
      actions.push([
        {
          text: isBlocked
            ? locale.employeeManage.unblock
            : locale.employeeManage.block,
          data: this.toSectionData(
            BotNamespace.EMPLOYEE_MANAGE,
            isBlocked
              ? EmployeeManageAction.UNBLOCK
              : EmployeeManageAction.BLOCK,
            user.id,
          ),
        },
        {
          text: locale.employeeManage.delete,
          data: this.toSectionData(
            BotNamespace.EMPLOYEE_MANAGE,
            EmployeeManageAction.DELETE,
            user.id,
          ),
        },
      ]);
    }
    return {
      screen: { text: lines.join('\n'), buttons: [...actions, ...back] },
      dialog: null,
    };
  }

  private askQuery(locale: Locale): BotReply {
    return {
      screen: {
        text: locale.employees.searchPrompt,
        buttons: [
          [
            {
              text: locale.employees.backToList,
              data: this.toData(EmployeesAction.LIST, 0),
            },
          ],
        ],
      },
      dialog: {
        namespace: BotNamespace.EMPLOYEES,
        step: EmployeesStep.SEARCH,
        data: {},
      },
    };
  }

  private async search(locale: Locale, text: string): Promise<BotReply> {
    const query = text.trim().replace(EMPLOYEES_USERNAME_PREFIX, '');
    if (query === '' || query.length > EMPLOYEES_QUERY_MAX_LENGTH) {
      return this.askQuery(locale);
    }

    const found = await this.userService.search(
      query,
      EMPLOYEES_SEARCH_LIMIT + 1,
    );
    const lines = [locale.employees.searchTitle(escapeMarkdown(query))];
    if (found.length === 0) {
      lines.push(locale.employees.searchEmpty);
    } else if (found.length > EMPLOYEES_SEARCH_LIMIT) {
      lines.push(locale.employees.searchTooMany(EMPLOYEES_SEARCH_LIMIT));
    }

    return {
      screen: {
        text: lines.join('\n'),
        buttons: [
          ...found
            .slice(0, EMPLOYEES_SEARCH_LIMIT)
            .map((user) => [this.toCardButton(locale, user, 0)]),
          [
            {
              text: locale.employees.search,
              data: this.toData(EmployeesAction.SEARCH),
            },
            {
              text: locale.employees.backToList,
              data: this.toData(EmployeesAction.LIST, 0),
            },
          ],
        ],
      },
      dialog: null,
    };
  }

  private toCardButton(locale: Locale, user: User, page: number) {
    const parts = [user.displayName, locale.roles[user.role]];
    if (user.status !== UserStatus.ACTIVE) {
      parts.push(locale.statuses[user.status]);
    }
    return {
      text: parts.join(EMPLOYEES_ITEM_SEPARATOR),
      data: this.toData(EmployeesAction.CARD, user.id, page),
    };
  }

  private toSectionData(namespace: BotNamespace, ...parts: string[]) {
    return [namespace, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }

  private toData(...parts: (string | number)[]) {
    return [BotNamespace.EMPLOYEES, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
