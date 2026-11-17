import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import { getToday } from 'src/common/utils/date.util';
import { AiService } from 'src/modules/application/ai/ai.service';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import { SettingsService } from 'src/modules/application/settings/settings.service';
import { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AccessService } from '../core/access.service';
import { BotSection } from '../core/bot.decorator';
import { BotAccess, BotCommand, BotNamespace } from '../core/types/bot.enums';
import type { BotContext, BotHandler, BotReply } from '../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../core/constants/bot.constants';
import { ADMIN_BUTTON_SCHEMA, ADMIN_SECTIONS } from './constants/admin.constants';
import { AdminSettingsView } from './settings/admin-settings.view';

@Injectable()
@BotSection({
  access: BotAccess.ADMIN,
  commands: [BotCommand.ADMIN],
  namespace: BotNamespace.ADMIN,
})
export class AdminHandler implements BotHandler {
  private readonly timeZone: string;

  constructor(
    private readonly accessService: AccessService,
    private readonly userService: UserService,
    private readonly settingsService: SettingsService,
    private readonly aiService: AiService,
    private readonly adminSettingsView: AdminSettingsView,
    configService: ConfigService<AppEnvs, true>,
  ) {
    this.timeZone = configService.get('APP_TIMEZONE', { infer: true });
  }

  async handle({ actor, locale, input }: BotContext): Promise<BotReply> {
    if (
      input.type === ChatInputType.BUTTON &&
      !ADMIN_BUTTON_SCHEMA.safeParse(input.data.split(BOT_BUTTON_DATA_SEPARATOR)).success
    ) {
      return { screen: { text: locale.bot.expired } };
    }

    const sections = ADMIN_SECTIONS.filter(({ access }) =>
      this.accessService.isAllowed(actor, access),
    ).map(({ section, data }) => ({ text: locale.admin.sections[section], data }));
    const lines = [locale.admin.title];
    if (sections.length === 0) {
      lines.push(locale.admin.noSections);
    } else if (this.accessService.isAllowed(actor, BotAccess.OWNER)) {
      lines.push(...(await this.toOverview(locale)));
    }
    return {
      screen: { text: lines.join('\n'), buttons: sections.map((section) => [section]) },
      dialog: null,
    };
  }

  private async toOverview(locale: Locale) {
    const texts = locale.adminSettings;
    const today = getToday(this.timeZone);
    const [total, active, settings] = await Promise.all([
      this.userService.count(),
      this.userService.countActive(),
      this.settingsService.findOne(),
    ]);
    const pause = this.settingsService.toReportsPause(settings, today);
    return [
      locale.admin.employees(total, active),
      `${texts.reports}: ${this.adminSettingsView.toPauseState(locale, pause, today)}`,
      this.aiService.isEnabled()
        ? `${texts.ai.name}: ${this.settingsService.toAi(settings).aiEnabled ? texts.on : texts.off}`
        : texts.aiNotConfigured,
    ];
  }
}
