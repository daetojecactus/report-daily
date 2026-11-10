import { ADMIN_MENU_DATA } from '../../admin/constants/admin.constants';
import { BotCommand, BotNamespace } from '../../bot.enums';
import { BOT_BUTTON_DATA_SEPARATOR } from '../../constants/bot.constants';
import { ReportAction } from '../../report/report.enums';
import { SettingsAction } from '../../settings/settings.enums';

export const HELP_SECTIONS = [
  {
    command: BotCommand.REPORT,
    data: [BotNamespace.REPORT, ReportAction.MENU].join(BOT_BUTTON_DATA_SEPARATOR),
  },
  {
    command: BotCommand.SETTINGS,
    data: [BotNamespace.SETTINGS, SettingsAction.MENU].join(BOT_BUTTON_DATA_SEPARATOR),
  },
  { command: BotCommand.ADMIN, data: ADMIN_MENU_DATA },
] as const;
