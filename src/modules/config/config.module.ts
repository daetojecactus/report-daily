import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ReportDailyBotEnvs } from './env';

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
            `Env validation failed:\n${errors.map((error) => Object.values(error.constraints ?? {}).join(', ')).join('\n')}`,
          );
        }
        return validated;
      },
    }),
  ],
})
export class AppConfigModule {}
