import { z } from 'zod';
import { BotNamespace } from '../../../core/types/bot.enums';
import { AdminSettingsAction } from '../types/admin-settings.enums';

export const ADMIN_SETTINGS_DAYS_AHEAD = 14;

export const ADMIN_SETTINGS_ON = 'on';

export const ADMIN_SETTINGS_OFF = 'off';

export const ADMIN_SETTINGS_AI_SWITCHES = [
  { action: AdminSettingsAction.AI, field: 'aiEnabled', text: 'ai' },
  { action: AdminSettingsAction.AI_COMMITS, field: 'aiSendCommits', text: 'aiCommits' },
  { action: AdminSettingsAction.AI_COMMENTS, field: 'aiSendComments', text: 'aiComments' },
] as const;

export const ADMIN_SETTINGS_DAYS_PER_ROW = 3;

export const ADMIN_SETTINGS_DATE_TIME_SUFFIX = 'T00:00:00Z';

export const ADMIN_SETTINGS_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
};

export const ADMIN_SETTINGS_DAY_BUTTON_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
};

const NAMESPACE_SCHEMA = z.literal(BotNamespace.ADMIN_SETTINGS);

export const ADMIN_SETTINGS_BUTTON_SCHEMA = z.union([
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.enum([
        AdminSettingsAction.MENU,
        AdminSettingsAction.TODAY,
        AdminSettingsAction.DAYS,
        AdminSettingsAction.FOREVER,
        AdminSettingsAction.RESUME,
      ]),
    ])
    .transform(([, action]) => ({ action })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(AdminSettingsAction.UNTIL), z.iso.date()])
    .transform(([, action, date]) => ({ action, date })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.enum([
        AdminSettingsAction.AI,
        AdminSettingsAction.AI_COMMITS,
        AdminSettingsAction.AI_COMMENTS,
      ]),
      z.enum([ADMIN_SETTINGS_ON, ADMIN_SETTINGS_OFF]),
    ])
    .transform(([, action, value]) => ({ action, isOn: value === ADMIN_SETTINGS_ON })),
]);
