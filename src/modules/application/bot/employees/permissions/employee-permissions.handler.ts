import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { Permission } from 'src/modules/application/user/types/user.enums';
import type { User } from 'src/modules/application/user/types/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import { BotSection } from '../../core/bot.decorator';
import { BotAccess, BotNamespace } from '../../core/types/bot.enums';
import type { BotActor, BotContext, BotHandler, BotReply } from '../../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../../core/constants/bot.constants';
import { EmployeesAction } from '../types/employees.enums';
import { MenuService } from '../../core/menu.service';
import { EMPLOYEE_PERMISSIONS_BUTTON_SCHEMA } from './constants/employee-permissions.constants';
import { EmployeePermissionsMessages } from './constants/employee-permissions.messages';
import { EmployeePermissionsAction } from './types/employee-permissions.enums';

@Injectable()
@BotSection({
  access: BotAccess.OWNER,
  namespace: BotNamespace.EMPLOYEE_PERMISSIONS,
})
export class EmployeePermissionsHandler implements BotHandler {
  private readonly logger = new Logger(EmployeePermissionsHandler.name);

  constructor(
    private readonly userService: UserService,
    private readonly channelService: ChannelService,
    private readonly menuService: MenuService,
  ) {}

  async handle({ actor, input, locale }: BotContext): Promise<BotReply> {
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }
    const button = EMPLOYEE_PERMISSIONS_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }

    const user = await this.userService.findById(button.data.userId);
    if (!user) {
      return {
        screen: {
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
    if (button.data.action === EmployeePermissionsAction.OPEN) {
      return this.show(locale, user);
    }

    const { action, permission } = button.data;
    const isGrant = action === EmployeePermissionsAction.GRANT;
    const updated = isGrant
      ? await this.userService.grantPermission(user.id, permission)
      : await this.userService.revokePermission(user.id, permission);
    if (!updated) {
      return this.show(locale, (await this.userService.findById(user.id)) ?? user);
    }

    this.log(actor, updated, permission, isGrant);
    await this.menuService.syncEmployee(updated, await this.channelService.findByUser(updated.id));
    return this.show(locale, updated);
  }

  private show(locale: Locale, user: User): BotReply {
    const { employeePermissions } = locale;
    const permissions = Object.values(Permission);
    return {
      screen: {
        text: [
          employeePermissions.title(escapeMarkdown(user.displayName)),
          '',
          ...permissions.map(
            (permission) =>
              `**${locale.permissions[permission]}** — ${employeePermissions.descriptions[permission]}`,
          ),
        ].join('\n'),
        buttons: [
          ...permissions.map((permission) => {
            const isGranted = user.permissions.includes(permission);
            return [
              {
                text: `${locale.permissions[permission]}: ${isGranted ? employeePermissions.granted : employeePermissions.revoked}`,
                data: [
                  BotNamespace.EMPLOYEE_PERMISSIONS,
                  isGranted ? EmployeePermissionsAction.REVOKE : EmployeePermissionsAction.GRANT,
                  user.id,
                  permission,
                ].join(BOT_BUTTON_DATA_SEPARATOR),
              },
            ];
          }),
          [
            {
              text: locale.employeeAdd.openCard,
              data: this.toEmployeesData(EmployeesAction.CARD, user.id, 0),
            },
          ],
        ],
      },
      dialog: null,
    };
  }

  private log(actor: BotActor, user: User, permission: Permission, isGrant: boolean) {
    this.logger.log(
      {
        userId: user.id,
        actorId: actor.user?.id ?? BotAccess.OWNER,
        permission,
      },
      isGrant
        ? EmployeePermissionsMessages.PERMISSION_GRANTED
        : EmployeePermissionsMessages.PERMISSION_REVOKED,
    );
  }

  private toEmployeesData(...parts: (string | number)[]) {
    return [BotNamespace.EMPLOYEES, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
