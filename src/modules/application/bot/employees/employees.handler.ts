import { Injectable } from '@nestjs/common';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ScreenButton } from 'src/common/channel/types/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import { UserStatus } from 'src/modules/application/user/types/user.enums';
import type { User } from 'src/modules/application/user/types/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import { ADMIN_MENU_DATA } from '../admin/constants/admin.constants';
import { BotSection } from '../core/bot.decorator';
import { BotAccess, BotNamespace } from '../core/types/bot.enums';
import type { BotContext, BotHandler, BotReply } from '../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../core/constants/bot.constants';
import {
  EMPLOYEES_BUTTON_SCHEMA,
  EMPLOYEES_ITEM_SEPARATOR,
  EMPLOYEES_PAGE_SIZE,
  EMPLOYEES_QUERY_MAX_LENGTH,
  EMPLOYEES_SEARCH_LIMIT,
  EMPLOYEES_USERNAME_PREFIX,
} from './constants/employees.constants';
import { EmployeeAddAction } from './add/types/employee-add.enums';
import { EmployeesCard } from './employees.card';
import { EmployeesAction, EmployeesStep } from './types/employees.enums';

@Injectable()
@BotSection({ access: BotAccess.OWNER, namespace: BotNamespace.EMPLOYEES })
export class EmployeesHandler implements BotHandler {
  constructor(
    private readonly userService: UserService,
    private readonly employeesCard: EmployeesCard,
  ) {}

  async handle({ actor, input, dialog, locale }: BotContext): Promise<BotReply> {
    if (input.type === ChatInputType.TEXT && dialog?.step === EmployeesStep.SEARCH) {
      return this.search(locale, input.text);
    }
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }

    const button = EMPLOYEES_BUTTON_SCHEMA.safeParse(input.data.split(BOT_BUTTON_DATA_SEPARATOR));
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case EmployeesAction.LIST:
        return this.showList(locale, button.data.page);
      case EmployeesAction.CARD:
        return this.employeesCard.show(actor, locale, button.data.id, button.data.page);
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
          ...employees.map((user) => [this.toCardButton(locale, user, current)]),
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

    const found = await this.userService.search(query, EMPLOYEES_SEARCH_LIMIT + 1);
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

  private toData(...parts: (string | number)[]) {
    return [BotNamespace.EMPLOYEES, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
