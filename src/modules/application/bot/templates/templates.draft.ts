import { Injectable } from '@nestjs/common';
import { getErrorMessage } from 'src/common/utils/error.util';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import { ReportService } from 'src/modules/application/report/report.service';
import {
  TEMPLATE_BODY_MAX_LENGTH,
  TEMPLATE_NAME_MAX_LENGTH,
} from 'src/modules/application/report/template/constants/template.constants';
import { TemplateService } from 'src/modules/application/report/template/template.service';
import type { BotActor } from '../types/bot.interface';
import { TEMPLATES_DATE_FORMAT, TEMPLATES_DATE_TIME_SUFFIX } from './constants/templates.constants';
import type { TemplateDraftCheck } from './types/templates.interface';

@Injectable()
export class TemplatesDraft {
  constructor(
    private readonly templateService: TemplateService,
    private readonly reportService: ReportService,
  ) {}

  toName(text: string) {
    const name = text.trim();
    return name.length > 0 && name.length <= TEMPLATE_NAME_MAX_LENGTH ? name : null;
  }

  async checkBody(locale: Locale, actor: BotActor, text: string): Promise<TemplateDraftCheck> {
    const body = text.trim();
    const failed = (error: string) => ({ body, error, preview: '' });
    if (body.length === 0 || body.length > TEMPLATE_BODY_MAX_LENGTH) {
      return failed(locale.templates.bodyInvalid(TEMPLATE_BODY_MAX_LENGTH));
    }
    const syntaxError = this.templateService.check(body);
    if (syntaxError) {
      return failed(locale.templates.syntaxError(escapeMarkdown(syntaxError)));
    }
    const report = actor.user ? await this.reportService.findLatestSnapshot(actor.user.id) : null;
    if (!report?.snapshot) {
      return {
        body,
        error: null,
        preview: [locale.templates.noPreview, '', locale.templates.previewHint].join('\n'),
      };
    }
    try {
      const output = await this.templateService.render(body, report.snapshot);
      return {
        body,
        error: null,
        preview: [
          locale.templates.preview(
            new Intl.DateTimeFormat(locale.phrases.dateLocale, TEMPLATES_DATE_FORMAT).format(
              new Date(`${report.reportDate}${TEMPLATES_DATE_TIME_SUFFIX}`),
            ),
          ),
          '',
          output || locale.templates.emptyOutput,
          '',
          locale.templates.previewHint,
        ].join('\n'),
      };
    } catch (error) {
      return failed(locale.templates.renderError(escapeMarkdown(getErrorMessage(error))));
    }
  }
}
