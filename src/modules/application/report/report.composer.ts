import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { SourceService } from 'src/modules/application/source/source.service';
import { TraitService } from 'src/modules/application/trait/trait.service';
import { TraitNameService } from 'src/modules/application/trait/trait-name/trait-name.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { ActivityService } from './activity/activity.service';
import type { ReportDraft, ReportRequest } from './report.interface';
import { TemplateContext } from './template/template.context';
import { TemplateService } from './template/template.service';

@Injectable()
export class ReportComposer {
  constructor(
    private readonly configService: ConfigService<AppEnvs, true>,
    private readonly sourceService: SourceService,
    private readonly traitService: TraitService,
    private readonly traitNameService: TraitNameService,
    private readonly activityService: ActivityService,
    private readonly templateContext: TemplateContext,
    private readonly templateService: TemplateService,
    private readonly i18nService: I18nService,
  ) {}

  async compose({ user, account, date, language }: ReportRequest): Promise<ReportDraft> {
    const timeZone = user.timezone ?? this.configService.get('APP_TIMEZONE', { infer: true });
    const day = await this.sourceService.collect(account, date, timeZone);
    await this.traitNameService.record(account.source, this.sourceService.findNames(day));
    const index = await this.traitService.loadIndex(account.source, user.role);
    const results = this.activityService.classify(
      day,
      { username: account.username, role: user.role },
      index,
    );
    const summaries = this.activityService.summarize(results);
    const locale = this.i18nService.getLocale(language);
    const context = this.templateContext.build(
      {
        date,
        language,
        employee: {
          name: user.displayName,
          username: account.username,
          role: user.role,
          gender: user.gender,
        },
        day,
        results,
        summaries,
      },
      locale,
    );
    const content = await this.templateService.renderStandard(context);
    return { timeZone, locale, day, results, summaries, context, content };
  }
}
