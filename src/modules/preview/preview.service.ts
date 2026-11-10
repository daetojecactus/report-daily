import { Injectable } from '@nestjs/common';
import { DEFAULT_LANGUAGE } from 'src/modules/application/i18n/constants/i18n.constants';
import { PhraseService } from 'src/modules/application/report/phrase/phrase.service';
import { ReportComposer } from 'src/modules/application/report/report.composer';
import { Source } from 'src/modules/application/source/source.enums';
import { UserService } from 'src/modules/application/user/user.service';
import { UserSourceService } from 'src/modules/application/user/user-source/user-source.service';
import { PREVIEW_EMPTY_REPORT } from './constants/preview.constants';
import type { PreviewOptions } from './preview.interface';
import { PreviewRenderer } from './preview.renderer';

@Injectable()
export class PreviewService {
  constructor(
    private readonly userService: UserService,
    private readonly userSourceService: UserSourceService,
    private readonly reportComposer: ReportComposer,
    private readonly phraseService: PhraseService,
    private readonly previewRenderer: PreviewRenderer,
  ) {}

  async describe(username: string, date: string, { trace, language, ai }: PreviewOptions) {
    const account = await this.userSourceService.findOneByUsername(Source.GITLAB, username);
    const user = account && (await this.userService.findById(account.userId));
    if (!account || !user) {
      return null;
    }
    const { timeZone, locale, day, results, summaries, content } =
      await this.reportComposer.compose({
        user,
        account,
        date,
        language: language ?? user.language ?? DEFAULT_LANGUAGE,
        ai,
      });
    const texts = {
      lines: new Map(
        results.map((result) => [result, this.phraseService.describe(result, user.gender, locale)]),
      ),
      summaries: new Map(
        summaries.map((summary) => [
          summary,
          this.phraseService.summarize(summary, user.gender, locale),
        ]),
      ),
    };
    return [
      [account.username, user.role, date, timeZone].join(' · '),
      `issues: ${day.issues.length}, merge requests without an issue: ${day.standaloneMergeRequests.length}, pushes without a merge request: ${day.standalonePushes.length}`,
      ...this.previewRenderer.render(day, results, trace, summaries, texts),
      '',
      'Report',
      content || PREVIEW_EMPTY_REPORT,
    ].join('\n');
  }
}
