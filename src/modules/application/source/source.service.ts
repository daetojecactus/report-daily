import { Injectable } from '@nestjs/common';
import type { UserSource } from 'src/modules/application/user/user-source/user-source.interface';
import { GitLabSourceService } from './gitlab/gitlab-source.service';
import { Source } from './source.enums';
import type { ActivitySource } from './source.interface';

@Injectable()
export class SourceService {
  private readonly sources: Record<Source, ActivitySource>;

  constructor(gitlabSourceService: GitLabSourceService) {
    this.sources = { [Source.GITLAB]: gitlabSourceService };
  }

  collect(account: UserSource, date: string, timeZone: string) {
    return this.sources[account.source].collect(account, date, timeZone);
  }
}
