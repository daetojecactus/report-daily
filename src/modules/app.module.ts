import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ReportDailyBotEnvs } from '../config/env';
import { ApiModule } from './api/api.module';
import { ApplicationModule } from './application/application.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const validated = plainToInstance(ReportDailyBotEnvs, config, {
          enableImplicitConversion: true,
        });
        const errors = validateSync(validated, {
          skipMissingProperties: false,
        });
        if (errors.length > 0) {
          throw new Error(
            `Env validation failed:\n${errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('\n')}`,
          );
        }
        return validated;
      },
    }),
    ScheduleModule.forRoot(),
    ApiModule,
    ApplicationModule,
    DatabaseModule,
  ],
})
export class AppModule {}
