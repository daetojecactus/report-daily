import { Injectable } from '@nestjs/common';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';

@Injectable()
export class TemplatesView {
  toName(locale: Locale, template: { name: string; ownerId: string | null } | null) {
    if (!template) {
      return locale.templates.standard;
    }
    const name = escapeMarkdown(template.name);
    return template.ownerId ? name : locale.templates.shared(name);
  }
}
