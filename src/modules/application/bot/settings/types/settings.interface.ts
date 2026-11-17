import type { SettingsAction } from './settings.enums';

export interface SettingsSwitch {
  action: SettingsAction.SCHEDULE | SettingsAction.AI | SettingsAction.AI_DATA;
  isOn: boolean;
}

export interface SettingsSwitchButton extends SettingsSwitch {
  isConfirmed: boolean;
}
