import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import { getErrorMessage } from 'src/common/utils/error.util';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import {
  Gender,
  JobRole,
  Permission,
} from 'src/modules/application/user/user.enums';
import { UserService } from 'src/modules/application/user/user.service';
import {
  GitLabRejectedError,
  GitLabRetryableError,
} from 'src/modules/vendors/gitlab/gitlab.error';
import type { GitLabUser } from 'src/modules/vendors/gitlab/gitlab.interface';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotNamespace } from '../bot.enums';
import type {
  BotActor,
  BotContext,
  BotDialog,
  BotHandler,
  BotReply,
} from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import {
  EMPLOYEES_ITEM_SEPARATOR,
  EMPLOYEES_QUERY_MAX_LENGTH,
  EMPLOYEES_USERNAME_PREFIX,
} from '../employees/constants/employees.constants';
import { EmployeeBindAction } from '../employee-bind/employee-bind.enums';
import { EmployeesAction } from '../employees/employees.enums';
import {
  EMPLOYEE_ADD_BUTTON_SCHEMA,
  EMPLOYEE_ADD_DRAFT_SCHEMA,
} from './constants/employee-add.constants';
import { EmployeeAddMessages } from './constants/employee-add.messages';
import { EmployeeAddAction, EmployeeAddStep } from './employee-add.enums';

@Injectable()
@BotSection({ access: Permission.USERS, namespace: BotNamespace.EMPLOYEE_ADD })
export class EmployeeAddHandler implements BotHandler {
  private readonly logger = new Logger(EmployeeAddHandler.name);

  constructor(
    private readonly userService: UserService,
    private readonly gitlabService: GitLabService,
  ) {}

  async handle({
    actor,
    input,
    dialog,
    locale,
  }: BotContext): Promise<BotReply> {
    if (input.type === ChatInputType.TEXT) {
      return this.search(locale, input.text);
    }
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }

    const button = EMPLOYEE_ADD_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case EmployeeAddAction.START:
        return this.askQuery(locale);
      case EmployeeAddAction.PICK:
        return this.pick(locale, dialog, button.data.gitlabUserId);
      case EmployeeAddAction.ROLE:
        return this.chooseRole(locale, dialog, button.data.role);
      case EmployeeAddAction.GENDER:
        return this.create(actor, locale, dialog, button.data.gender);
      case EmployeeAddAction.CANCEL:
        return {
          screen: {
            text: locale.employeeAdd.cancelled,
            buttons: [[this.toListButton(locale)]],
          },
          dialog: null,
        };
    }
  }

  private askQuery(locale: Locale, text = locale.employeeAdd.prompt): BotReply {
    return {
      screen: { text, buttons: [[this.toCancelButton(locale)]] },
      dialog: this.toDialog(EmployeeAddStep.QUERY, {}),
    };
  }

  private async search(locale: Locale, text: string): Promise<BotReply> {
    const query = text.trim().replace(EMPLOYEES_USERNAME_PREFIX, '');
    if (query === '' || query.length > EMPLOYEES_QUERY_MAX_LENGTH) {
      return this.askQuery(locale);
    }

    let candidates: GitLabUser[];
    try {
      candidates = await this.gitlabService.searchUsers(query);
    } catch (error) {
      if (!this.isGitLabFailure(error)) {
        throw error;
      }
      this.logger.warn(
        `${EmployeeAddMessages.GITLAB_FAILED}: ${getErrorMessage(error)}`,
      );
      return this.askQuery(locale, locale.employeeAdd.gitlabUnavailable);
    }
    if (candidates.length === 0) {
      return this.askQuery(locale, locale.employeeAdd.noMatches);
    }

    return {
      screen: {
        text: locale.employeeAdd.pick(escapeMarkdown(query)),
        buttons: [
          ...candidates.map((candidate) => [
            {
              text: [candidate.name, `@${candidate.username}`].join(
                EMPLOYEES_ITEM_SEPARATOR,
              ),
              data: this.toData(EmployeeAddAction.PICK, candidate.id),
            },
          ]),
          [this.toCancelButton(locale)],
        ],
      },
      dialog: this.toDialog(EmployeeAddStep.PICK, {
        candidates: candidates.map(({ id, username, name }) => ({
          id,
          username,
          name,
        })),
      }),
    };
  }

  private async pick(
    locale: Locale,
    dialog: BotDialog | null,
    gitlabUserId: number,
  ): Promise<BotReply> {
    const candidate = this.readDraft(
      dialog,
      EmployeeAddStep.PICK,
    )?.candidates?.find((item) => item.id === gitlabUserId);
    if (!candidate) {
      return { screen: { text: locale.bot.expired } };
    }
    const existing = await this.userService.findByGitlabId(candidate.id);
    if (existing) {
      return this.showExisting(locale, existing.id, existing.displayName);
    }

    return {
      screen: {
        text: locale.employeeAdd.role(escapeMarkdown(candidate.name)),
        buttons: [
          ...Object.values(JobRole).map((role) => [
            {
              text: locale.roles[role],
              data: this.toData(EmployeeAddAction.ROLE, role),
            },
          ]),
          [this.toCancelButton(locale)],
        ],
      },
      dialog: this.toDialog(EmployeeAddStep.ROLE, { candidate }),
    };
  }

  private chooseRole(
    locale: Locale,
    dialog: BotDialog | null,
    role: JobRole,
  ): BotReply {
    const candidate = this.readDraft(dialog, EmployeeAddStep.ROLE)?.candidate;
    if (!candidate) {
      return { screen: { text: locale.bot.expired } };
    }

    return {
      screen: {
        text: locale.employeeAdd.gender(escapeMarkdown(candidate.name)),
        buttons: [
          Object.values(Gender).map((gender) => ({
            text: locale.genders[gender],
            data: this.toData(EmployeeAddAction.GENDER, gender),
          })),
          [this.toCancelButton(locale)],
        ],
      },
      dialog: this.toDialog(EmployeeAddStep.GENDER, { candidate, role }),
    };
  }

  private async create(
    actor: BotActor,
    locale: Locale,
    dialog: BotDialog | null,
    gender: Gender,
  ): Promise<BotReply> {
    const draft = this.readDraft(dialog, EmployeeAddStep.GENDER);
    if (!draft?.candidate || !draft.role) {
      return { screen: { text: locale.bot.expired } };
    }
    const { candidate, role } = draft;
    const existing = await this.userService.findByGitlabId(candidate.id);
    if (existing) {
      return this.showExisting(locale, existing.id, existing.displayName);
    }

    const user = await this.userService.create({
      gitlabUserId: candidate.id,
      gitlabUsername: candidate.username,
      displayName: candidate.name,
      role,
      gender,
    });
    this.logger.log(
      { userId: user.id, actorId: actor.user?.id ?? BotAccess.OWNER },
      EmployeeAddMessages.EMPLOYEE_ADDED,
    );

    const lines = [locale.employeeAdd.added(escapeMarkdown(user.displayName))];
    const isActivityVisible = await this.checkActivity(user.gitlabUserId);
    if (isActivityVisible === false) {
      lines.push(locale.employeeAdd.activityHidden);
    }
    if (isActivityVisible === null) {
      lines.push(locale.employeeAdd.activityUnknown);
    }
    lines.push(locale.employeeAdd.pending);

    return {
      screen: {
        text: lines.join('\n\n'),
        buttons: [
          [
            {
              text: locale.employees.bind(locale.channels[actor.channel]),
              data: [
                BotNamespace.EMPLOYEE_BIND,
                EmployeeBindAction.START,
                user.id,
              ].join(BOT_BUTTON_DATA_SEPARATOR),
            },
          ],
          [this.toCardButton(locale, user.id)],
          [this.toListButton(locale)],
        ],
      },
      dialog: null,
    };
  }

  private showExisting(locale: Locale, id: string, name: string): BotReply {
    return {
      screen: {
        text: locale.employeeAdd.alreadyAdded(escapeMarkdown(name)),
        buttons: [[this.toCardButton(locale, id)]],
      },
      dialog: null,
    };
  }

  private async checkActivity(gitlabUserId: number) {
    try {
      return await this.gitlabService.hasVisibleActivity(gitlabUserId);
    } catch (error) {
      if (!this.isGitLabFailure(error)) {
        throw error;
      }
      this.logger.warn(
        `${EmployeeAddMessages.GITLAB_FAILED}: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }

  private isGitLabFailure(error: unknown) {
    return (
      error instanceof GitLabRetryableError ||
      error instanceof GitLabRejectedError
    );
  }

  private readDraft(dialog: BotDialog | null, step: string) {
    if (
      dialog?.namespace !== BotNamespace.EMPLOYEE_ADD ||
      dialog.step !== step
    ) {
      return null;
    }
    const draft = EMPLOYEE_ADD_DRAFT_SCHEMA.safeParse(dialog.data);
    return draft.success ? draft.data : null;
  }

  private toDialog(step: EmployeeAddStep, data: Record<string, unknown>) {
    return { namespace: BotNamespace.EMPLOYEE_ADD, step, data };
  }

  private toData(...parts: (string | number)[]) {
    return [BotNamespace.EMPLOYEE_ADD, ...parts].join(
      BOT_BUTTON_DATA_SEPARATOR,
    );
  }

  private toCancelButton(locale: Locale) {
    return {
      text: locale.employeeAdd.cancel,
      data: this.toData(EmployeeAddAction.CANCEL),
    };
  }

  private toCardButton(locale: Locale, id: string) {
    return {
      text: locale.employeeAdd.openCard,
      data: [BotNamespace.EMPLOYEES, EmployeesAction.CARD, id, 0].join(
        BOT_BUTTON_DATA_SEPARATOR,
      ),
    };
  }

  private toListButton(locale: Locale) {
    return {
      text: locale.employees.backToList,
      data: [BotNamespace.EMPLOYEES, EmployeesAction.LIST, 0].join(
        BOT_BUTTON_DATA_SEPARATOR,
      ),
    };
  }
}
