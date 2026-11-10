import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatChannel, ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { getErrorMessage } from 'src/common/utils/error.util';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import { ReportService } from 'src/modules/application/report/report.service';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { UserSourceService } from 'src/modules/application/user/user-source/user-source.service';
import { UserStatus } from 'src/modules/application/user/user.enums';
import type { User } from 'src/modules/application/user/user.interface';
import type { UserChannel } from 'src/modules/application/user/channel/channel.interface';
import { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import {
  GitLabCertificateError,
  GitLabRejectedError,
  GitLabRetryableError,
} from 'src/modules/vendors/gitlab/gitlab.error';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import { AccessService } from '../access/access.service';
import { BotNamespace } from '../bot.enums';
import type { BotActor, BotReply } from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR, BOT_CHANNELS } from '../constants/bot.constants';
import { EmployeeBindAction } from '../employee-bind/employee-bind.enums';
import { EmployeeManageAction } from '../employee-manage/employee-manage.enums';
import { EmployeePermissionsAction } from '../employee-permissions/employee-permissions.enums';
import {
  EMPLOYEES_ACTIVITY_FORMAT,
  EMPLOYEES_REPORT_DATE_FORMAT,
  EMPLOYEES_REPORT_DATE_SUFFIX,
} from './constants/employees.constants';
import { EmployeesMessages } from './constants/employees.messages';
import { EmployeesAction } from './employees.enums';

@Injectable()
export class EmployeesCard {
  private readonly logger = new Logger(EmployeesCard.name);

  constructor(
    private readonly configService: ConfigService<AppEnvs, true>,
    private readonly userService: UserService,
    private readonly channelService: ChannelService,
    private readonly userSourceService: UserSourceService,
    private readonly accessService: AccessService,
    private readonly reportService: ReportService,
    private readonly gitlabService: GitLabService,
    @Inject(BOT_CHANNELS) private readonly channels: ChatChannel[],
  ) {}

  async show(actor: BotActor, locale: Locale, id: string, page: number): Promise<BotReply> {
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
    const [channels, accounts, report] = await Promise.all([
      this.channelService.findByUser(user.id),
      this.userSourceService.findByUser(user.id),
      this.reportService.findLatest(user.id),
    ]);
    const lines = [
      `**${escapeMarkdown(user.displayName)}**`,
      ...accounts.map(
        (account) => `${locale.sources[account.source]}: @${escapeMarkdown(account.username)}`,
      ),
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
    const [account] = accounts;
    if (account) {
      lines.push(
        `${card.lastActivity}: ${await this.describeActivity(locale, user, Number(account.externalId))}`,
      );
    }
    lines.push(
      `${card.lastReport}: ${
        report
          ? `${new Intl.DateTimeFormat(
              locale.phrases.dateLocale,
              EMPLOYEES_REPORT_DATE_FORMAT,
            ).format(
              new Date(`${report.reportDate}${EMPLOYEES_REPORT_DATE_SUFFIX}`),
            )} — ${card.reportStatuses[report.status]}`
          : card.noReport
      }`,
    );

    const actions: ScreenButton[][] = [];
    if (user.status === UserStatus.ACTIVE && channels.length > 0) {
      actions.push([
        {
          text: locale.employeeManage.reportNow,
          data: this.toSectionData(
            BotNamespace.EMPLOYEE_MANAGE,
            EmployeeManageAction.REPORT,
            user.id,
          ),
        },
      ]);
    }
    const bindButtons = this.toBindButtons(locale, user.id, channels);
    if (bindButtons.length > 0) {
      actions.push(bindButtons);
    }
    actions.push([
      {
        text: locale.employeeManage.changeRole,
        data: this.toSectionData(BotNamespace.EMPLOYEE_MANAGE, EmployeeManageAction.ROLE, user.id),
      },
    ]);
    if (actor.isOwner) {
      actions.push([
        {
          text: locale.employeePermissions.open,
          data: this.toSectionData(
            BotNamespace.EMPLOYEE_PERMISSIONS,
            EmployeePermissionsAction.OPEN,
            user.id,
          ),
        },
      ]);
    }
    if (this.accessService.canManage(actor, user)) {
      const isBlocked = user.status === UserStatus.BLOCKED;
      actions.push([
        {
          text: isBlocked ? locale.employeeManage.unblock : locale.employeeManage.block,
          data: this.toSectionData(
            BotNamespace.EMPLOYEE_MANAGE,
            isBlocked ? EmployeeManageAction.UNBLOCK : EmployeeManageAction.BLOCK,
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

  private async describeActivity(locale: Locale, user: User, gitlabUserId: number) {
    try {
      const at = await this.gitlabService.findLastActivityAt(gitlabUserId);
      if (!at) {
        return locale.employees.card.activityHidden;
      }
      return new Intl.DateTimeFormat(locale.phrases.dateLocale, {
        ...EMPLOYEES_ACTIVITY_FORMAT,
        timeZone: user.timezone ?? this.configService.get('APP_TIMEZONE', { infer: true }),
      }).format(new Date(at));
    } catch (error) {
      if (
        !(error instanceof GitLabRetryableError) &&
        !(error instanceof GitLabRejectedError) &&
        !(error instanceof GitLabCertificateError)
      ) {
        throw error;
      }
      this.logger.warn(`${EmployeesMessages.ACTIVITY_FAILED}: ${getErrorMessage(error)}`);
      return locale.employees.card.activityUnknown;
    }
  }

  toBindButtons(locale: Locale, userId: string, bound: UserChannel[]): ScreenButton[] {
    return this.channels
      .filter(({ channel }) => !bound.some((item) => item.channel === channel))
      .map(({ channel }) => ({
        text: locale.employees.bind(locale.channels[channel]),
        data: this.toSectionData(
          BotNamespace.EMPLOYEE_BIND,
          EmployeeBindAction.START,
          userId,
          channel,
        ),
      }));
  }

  private toSectionData(namespace: BotNamespace, ...parts: string[]) {
    return [namespace, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }

  private toData(...parts: (string | number)[]) {
    return [BotNamespace.EMPLOYEES, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
