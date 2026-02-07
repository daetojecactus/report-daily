import { Injectable } from '@nestjs/common';
import { UserService } from '../user.service';
import { Settings } from './settings.schema';

@Injectable()
export class SettingsService {
  constructor(private readonly userService: UserService) {}

  async updateSettings(adminId: string, partialSettings: Partial<Settings>) {
    return this.userService.updateUserSettings({ adminId }, partialSettings);
  }
}
