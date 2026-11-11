import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Source } from 'src/modules/application/source/types/source.enums';
import type { GroupedDailyData } from 'src/modules/application/source/types/source.interface';
import { SourceService } from 'src/modules/application/source/source.service';
import { UserService } from 'src/modules/application/user/user.service';
import { UserSourceService } from 'src/modules/application/user/user-source/user-source.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { PREVIEW_FIXTURE_EXTENSION } from './constants/preview.constants';
import { PreviewAnonymizer } from './preview.anonymizer';
import type { PreviewFixtureFile } from './types/preview.interface';

@Injectable()
export class PreviewRecorder {
  constructor(
    private readonly configService: ConfigService<AppEnvs, true>,
    private readonly userService: UserService,
    private readonly userSourceService: UserSourceService,
    private readonly sourceService: SourceService,
    private readonly previewAnonymizer: PreviewAnonymizer,
  ) {}

  async record(dates: string[]) {
    const aliases = this.previewAnonymizer.createAliases();
    const employees = await this.loadEmployees();
    const files: PreviewFixtureFile[] = [];
    for (const date of dates) {
      for (const { account, role, timeZone } of employees) {
        const day = await this.sourceService.collect(account, date, timeZone);
        if (this.isEmpty(day)) {
          continue;
        }
        const username = this.previewAnonymizer.toUser(account.username, aliases);
        files.push({
          name: [role, username, date].join('-') + PREVIEW_FIXTURE_EXTENSION,
          fixture: {
            role,
            username,
            date,
            timeZone,
            day: this.previewAnonymizer.anonymizeDay(day, aliases),
          },
        });
      }
    }
    return files;
  }

  private async loadEmployees() {
    const accounts = await this.userSourceService.findBySource(Source.GITLAB);
    const employees = await Promise.all(
      accounts.map(async (account) => {
        const user = await this.userService.findById(account.userId);
        return user
          ? [
              {
                account,
                role: user.role,
                timeZone: user.timezone ?? this.configService.get('APP_TIMEZONE', { infer: true }),
              },
            ]
          : [];
      }),
    );
    return employees.flat();
  }

  private isEmpty(day: GroupedDailyData) {
    return (
      day.issues.length === 0 &&
      day.standaloneMergeRequests.length === 0 &&
      day.standalonePushes.length === 0
    );
  }
}
