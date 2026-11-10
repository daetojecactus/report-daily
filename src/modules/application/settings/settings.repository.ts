import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import { SETTINGS_ROW_ID } from './constants/settings.constants';
import type { SettingsUpdate } from './settings.interface';
import { settings } from './settings.schema';

@Injectable()
export class SettingsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findOne() {
    const [row] = await this.databaseService.db
      .select()
      .from(settings)
      .where(eq(settings.id, SETTINGS_ROW_ID))
      .limit(1);
    return row ?? null;
  }

  async upsert(values: SettingsUpdate) {
    const [row] = await this.databaseService.db
      .insert(settings)
      .values({ id: SETTINGS_ROW_ID, ...values })
      .onConflictDoUpdate({ target: settings.id, set: values })
      .returning();
    return row;
  }
}
