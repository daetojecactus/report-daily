import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getToday } from 'src/common/utils/date.util';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { ReportQueueProducer } from 'src/modules/queue/report/report-queue.producer';
import { REPORT_TODAY_MAX_AGE_MS } from '../report/constants/report.constants';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import { JobRole, Permission, UserStatus } from 'src/modules/application/user/user.enums';
import type { User } from 'src/modules/application/user/user.interface';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { UserService } from 'src/modules/application/user/user.service';
import { AccessService } from '../access/access.service';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotNamespace } from '../bot.enums';
import type { BotActor, BotContext, BotHandler, BotReply } from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import { EmployeesAction } from '../employees/employees.enums';
import { MenuService } from '../menu/menu.service';
import { EMPLOYEE_MANAGE_BUTTON_SCHEMA } from './constants/employee-manage.constants';
import { EmployeeManageMessages } from './constants/employee-manage.messages';
import { EmployeeManageAction } from './employee-manage.enums';

@Injectable()
@BotSection({
  access: Permission.USERS,
  namespace: BotNamespace.EMPLOYEE_MANAGE,
})
export class EmployeeManageHandler implements BotHandler {
  private readonly logger = new Logger(EmployeeManageHandler.name);

  constructor(
    private readonly userService: UserService,
    private readonly channelService: ChannelService,
    private readonly accessService: AccessService,
    private readonly menuService: MenuService,
    private readonly configService: ConfigService<AppEnvs, true>,
    private readonly reportQueueProducer: ReportQueueProducer,
  ) {}

  async handle({ actor, input, locale }: BotContext): Promise<BotReply> {
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }
    const button = EMPLOYEE_MANAGE_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }

    const user = await this.userService.findById(button.data.userId);
    if (!user) {
      return this.reply(locale.employees.notFound, [[this.toListButton(locale)]]);
    }
    switch (button.data.action) {
      case EmployeeManageAction.ROLE:
        return this.askRole(locale, user);
      case EmployeeManageAction.SET_ROLE:
        return this.changeRole(actor, locale, user, button.data.role);
      case EmployeeManageAction.REPORT:
        return this.sendReport(actor, locale, user);
      default:
        return this.manage(actor, locale, user, button.data.action);
    }
  }

  private async manage(
    actor: BotActor,
    locale: Locale,
    user: User,
    action: Exclude<
      EmployeeManageAction,
      EmployeeManageAction.ROLE | EmployeeManageAction.SET_ROLE | EmployeeManageAction.REPORT
    >,
  ): Promise<BotReply> {
    if (!this.accessService.canManage(actor, user)) {
      return this.reply(
        actor.user?.id === user.id ? locale.employeeManage.self : locale.employeeManage.ownerOnly,
        [[this.toCardButton(locale, user.id)]],
      );
    }

    const name = escapeMarkdown(user.displayName);
    switch (action) {
      case EmployeeManageAction.BLOCK:
        await this.syncMenu(await this.userService.block(user.id));
        this.log(actor, user, EmployeeManageMessages.BLOCKED);
        return this.done(locale, user, locale.employeeManage.blocked(name));
      case EmployeeManageAction.UNBLOCK:
        await this.syncMenu(await this.userService.unblock(user.id));
        this.log(actor, user, EmployeeManageMessages.UNBLOCKED);
        return this.done(locale, user, locale.employeeManage.unblocked(name));
      case EmployeeManageAction.DELETE:
        return this.reply(locale.employeeManage.confirmDelete(name), [
          [
            {
              text: locale.employeeManage.confirm,
              data: this.toData(EmployeeManageAction.CONFIRM_DELETE, user.id),
            },
            {
              text: locale.employeeManage.cancel,
              data: this.toCardData(user.id),
            },
          ],
        ]);
      case EmployeeManageAction.CONFIRM_DELETE: {
        const channels = await this.channelService.findByUser(user.id);
        await this.userService.deleteById(user.id);
        await this.menuService.syncEmployee(null, channels);
        this.log(actor, user, EmployeeManageMessages.DELETED);
        return this.reply(locale.employeeManage.deleted(name), [[this.toListButton(locale)]]);
      }
    }
  }

  private async sendReport(actor: BotActor, locale: Locale, user: User): Promise<BotReply> {
    const name = escapeMarkdown(user.displayName);
    const channels = await this.channelService.findByUser(user.id);
    if (
      user.status !== UserStatus.ACTIVE ||
      !channels.some((channel) => channel.channel === Channel.TELEGRAM)
    ) {
      return this.reply(locale.employeeManage.reportUnavailable(name), [
        [this.toCardButton(locale, user.id)],
      ]);
    }
    await this.reportQueueProducer.addReport({
      userId: user.id,
      date: getToday(user.timezone ?? this.configService.get('APP_TIMEZONE', { infer: true })),
      maxAgeMs: REPORT_TODAY_MAX_AGE_MS,
      reply: { channel: actor.channel, chatId: actor.chatId, externalId: actor.externalId },
      notices: {
        empty: locale.employeeManage.reportEmpty(name),
        failed: locale.employeeManage.reportFailed(name),
      },
    });
    this.log(actor, user, EmployeeManageMessages.REPORT_REQUESTED);
    return this.reply(locale.employeeManage.reportQueued(name), [
      [this.toCardButton(locale, user.id)],
    ]);
  }

  private async syncMenu(user: User | null) {
    if (user) {
      await this.menuService.syncEmployee(user, await this.channelService.findByUser(user.id));
    }
  }

  private askRole(locale: Locale, user: User): BotReply {
    return this.reply(
      locale.employeeManage.chooseRole(escapeMarkdown(user.displayName), locale.roles[user.role]),
      [
        ...Object.values(JobRole)
          .filter((role) => role !== user.role)
          .map((role) => [
            {
              text: locale.roles[role],
              data: this.toData(EmployeeManageAction.SET_ROLE, user.id, role),
            },
          ]),
        [
          {
            text: locale.employeeManage.cancel,
            data: this.toCardData(user.id),
          },
        ],
      ],
    );
  }

  private async changeRole(
    actor: BotActor,
    locale: Locale,
    user: User,
    role: JobRole,
  ): Promise<BotReply> {
    await this.userService.changeRole(user.id, role);
    this.logger.log(
      {
        userId: user.id,
        actorId: actor.user?.id ?? BotAccess.OWNER,
        role,
      },
      EmployeeManageMessages.ROLE_CHANGED,
    );
    return this.done(
      locale,
      user,
      locale.employeeManage.roleChanged(escapeMarkdown(user.displayName), locale.roles[role]),
    );
  }

  private done(locale: Locale, user: User, text: string): BotReply {
    return this.reply(text, [[this.toCardButton(locale, user.id)], [this.toListButton(locale)]]);
  }

  private reply(text: string, buttons: ScreenButton[][]): BotReply {
    return { screen: { text, buttons }, dialog: null };
  }

  private log(actor: BotActor, user: User, message: EmployeeManageMessages) {
    this.logger.log({ userId: user.id, actorId: actor.user?.id ?? BotAccess.OWNER }, message);
  }

  private toData(...parts: string[]) {
    return [BotNamespace.EMPLOYEE_MANAGE, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }

  private toCardData(userId: string) {
    return [BotNamespace.EMPLOYEES, EmployeesAction.CARD, userId, 0].join(
      BOT_BUTTON_DATA_SEPARATOR,
    );
  }

  private toCardButton(locale: Locale, userId: string) {
    return { text: locale.employeeAdd.openCard, data: this.toCardData(userId) };
  }

  private toListButton(locale: Locale) {
    return {
      text: locale.employees.backToList,
      data: [BotNamespace.EMPLOYEES, EmployeesAction.LIST, 0].join(BOT_BUTTON_DATA_SEPARATOR),
    };
  }
}
