import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotSettings, BotSettingsSchema } from './bot-settings.schema';
import { BotSettingsRepository } from './bot-settings.repository';
import { BotSettingsService } from './bot-settings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BotSettings.name, schema: BotSettingsSchema },
    ]),
  ],
  providers: [BotSettingsRepository, BotSettingsService],
  exports: [BotSettingsService],
})
export class BotSettingsModule {}
