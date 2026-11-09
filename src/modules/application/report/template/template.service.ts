import { Injectable } from '@nestjs/common';
import { Liquid } from 'liquidjs';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import {
  TEMPLATE_MEMORY_LIMIT,
  TEMPLATE_PARSE_LIMIT,
  TEMPLATE_RENDER_LIMIT_MS,
  TEMPLATE_STANDARD,
} from './constants/template.constants';
import type { ReportContext } from './template.interface';

@Injectable()
export class TemplateService {
  private readonly liquid = new Liquid({
    templates: {},
    ownPropertyOnly: true,
    strictFilters: true,
    parseLimit: TEMPLATE_PARSE_LIMIT,
    renderLimit: TEMPLATE_RENDER_LIMIT_MS,
    memoryLimit: TEMPLATE_MEMORY_LIMIT,
    outputEscape: (value: unknown) => escapeMarkdown(this.toText(value)),
  });

  render(source: string, context: ReportContext) {
    return this.liquid.parseAndRender(source, { context }) as Promise<string>;
  }

  renderStandard(context: ReportContext) {
    return this.render(TEMPLATE_STANDARD, context);
  }

  private toText(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return Array.isArray(value) ? value.map((item) => this.toText(item)).join('') : '';
  }
}
