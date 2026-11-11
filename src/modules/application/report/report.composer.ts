import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from 'src/common/utils/error.util';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { SourceService } from 'src/modules/application/source/source.service';
import { TraitService } from 'src/modules/application/trait/trait.service';
import { TraitNameService } from 'src/modules/application/trait/trait-name/trait-name.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { ActivityService } from './activity/activity.service';
import { ReportMessages } from './constants/report.messages';
import type { ReportDraft, ReportRequest } from './types/report.interface';
import { ReportRewriter } from './report.rewriter';
import type { ReportContext } from './template/types/template.interface';
import { TemplateContext } from './template/template.context';
import { TemplateService } from './template/template.service';

@Injectable()
export class ReportComposer {
  private readonly logger = new Logger(ReportComposer.name);

  constructor(
    private readonly configService: ConfigService<AppEnvs, true>,
    private readonly sourceService: SourceService,
    private readonly traitService: TraitService,
    private readonly traitNameService: TraitNameService,
    private readonly activityService: ActivityService,
    private readonly templateContext: TemplateContext,
    private readonly templateService: TemplateService,
    private readonly i18nService: I18nService,
    private readonly reportRewriter: ReportRewriter,
  ) {}

  async compose({ user, account, date, language, ai }: ReportRequest): Promise<ReportDraft> {
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
    const built = this.templateContext.buildWithSources(
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
    const aiModel = ai
      ? await this.reportRewriter.rewrite(built, { user, locale, policy: ai, index })
      : null;
    const { context } = built;
    const { content, templateId } = await this.render(user.id, user.templateId, context);
    return { timeZone, locale, day, results, summaries, context, content, templateId, aiModel };
  }

  private async render(userId: string, templateId: string | null, context: ReportContext) {
    const template = templateId ? await this.templateService.findById(templateId) : null;
    if (template && this.templateService.isAvailable(template, userId)) {
      try {
        return {
          content: await this.templateService.render(template.body, context),
          templateId: template.id,
        };
      } catch (error) {
        this.logger.warn(
          { userId, templateId: template.id, error: getErrorMessage(error) },
          ReportMessages.TEMPLATE_FAILED,
        );
      }
    }
    return { content: await this.templateService.renderStandard(context), templateId: null };
  }
}
