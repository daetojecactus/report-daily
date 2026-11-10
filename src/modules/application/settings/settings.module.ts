import { Module } from '@nestjs/common';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

@Module({
  providers: [SettingsService, SettingsRepository],
  exports: [SettingsService],
})
export class SettingsModule {}
