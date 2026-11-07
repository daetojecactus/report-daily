import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityService } from 'src/modules/application/report/activity/activity.service';
import { Source } from 'src/modules/application/source/source.enums';
import { SourceService } from 'src/modules/application/source/source.service';
import { TraitService } from 'src/modules/application/trait/trait.service';
import { UserService } from 'src/modules/application/user/user.service';
import { UserSourceService } from 'src/modules/application/user/user-source/user-source.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { PreviewRenderer } from './preview.renderer';

@Injectable()
export class PreviewService {
  constructor(
    private readonly configService: ConfigService<AppEnvs, true>,
    private readonly userService: UserService,
    private readonly userSourceService: UserSourceService,
    private readonly sourceService: SourceService,
    private readonly traitService: TraitService,
    private readonly activityService: ActivityService,
    private readonly previewRenderer: PreviewRenderer,
  ) {}

  async describe(username: string, date: string, trace: boolean) {
    const account = await this.userSourceService.findOneByUsername(Source.GITLAB, username);
    const user = account && (await this.userService.findById(account.userId));
    if (!account || !user) {
      return null;
    }
    const timeZone = user.timezone ?? this.configService.get('APP_TIMEZONE', { infer: true });
    const day = await this.sourceService.collect(account, date, timeZone);
    const index = await this.traitService.loadIndex(Source.GITLAB, user.role);
    const results = this.activityService.classify(
      day,
      { username: account.username, role: user.role },
      index,
    );
    return [
      [account.username, user.role, date, timeZone].join(' · '),
      `issues: ${day.issues.length}, merge requests without an issue: ${day.standaloneMergeRequests.length}, pushes without a merge request: ${day.standalonePushes.length}`,
      ...this.previewRenderer.render(day, results, trace),
    ].join('\n');
  }
}
