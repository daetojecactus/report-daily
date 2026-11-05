import { z } from 'zod';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { USER_REPORT_TIME_STEP_MINUTES } from 'src/modules/application/user/constants/user.constants';
import { Gender } from 'src/modules/application/user/user.enums';
import { BotNamespace } from '../../bot.enums';
import { SettingsAction } from '../settings.enums';

export const SETTINGS_HOURS_PER_ROW = 6;

export const SETTINGS_TIME_LENGTH = 5;

export const SETTINGS_TIME_SEPARATOR = ':';

export const SETTINGS_DEFAULT_TIME_ZONE = 'default';

export const SETTINGS_ON = 'on';

export const SETTINGS_OFF = 'off';

export const SETTINGS_HOURS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, '0'),
);

export const SETTINGS_MINUTES = Array.from(
  { length: 60 / USER_REPORT_TIME_STEP_MINUTES },
  (_, index) => String(index * USER_REPORT_TIME_STEP_MINUTES).padStart(2, '0'),
);

const NAMESPACE_SCHEMA = z.literal(BotNamespace.SETTINGS);

const SWITCH_SCHEMA = z
  .enum([SETTINGS_ON, SETTINGS_OFF])
  .transform((value) => value === SETTINGS_ON);

const HOUR_SCHEMA = z.string().refine((hour) => SETTINGS_HOURS.includes(hour));

const MINUTE_SCHEMA = z
  .string()
  .refine((minute) => SETTINGS_MINUTES.includes(minute));

export const SETTINGS_BUTTON_SCHEMA = z.union([
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(SettingsAction.MENU)])
    .transform(([, action]) => ({ action })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(SettingsAction.LANGUAGE)])
    .transform(([, action]) => ({ action, language: null })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.literal(SettingsAction.LANGUAGE),
      z.enum(Language),
    ])
    .transform(([, action, language]) => ({ action, language })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(SettingsAction.TIME)])
    .transform(([, action]) => ({ action, hour: null, minute: null })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(SettingsAction.TIME), HOUR_SCHEMA])
    .transform(([, action, hour]) => ({ action, hour, minute: null })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.literal(SettingsAction.TIME),
      HOUR_SCHEMA,
      MINUTE_SCHEMA,
    ])
    .transform(([, action, hour, minute]) => ({ action, hour, minute })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(SettingsAction.TIME_ZONE)])
    .transform(([, action]) => ({ action, isDefault: false })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.literal(SettingsAction.TIME_ZONE),
      z.literal(SETTINGS_DEFAULT_TIME_ZONE),
    ])
    .transform(([, action]) => ({ action, isDefault: true })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(SettingsAction.GENDER)])
    .transform(([, action]) => ({ action, gender: null })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(SettingsAction.GENDER), z.enum(Gender)])
    .transform(([, action, gender]) => ({ action, gender })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.enum([SettingsAction.AI, SettingsAction.AI_DATA]),
      SWITCH_SCHEMA,
    ])
    .transform(([, action, isOn]) => ({ action, isOn })),
]);
