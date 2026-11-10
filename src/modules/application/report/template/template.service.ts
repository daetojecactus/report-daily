import { Injectable } from '@nestjs/common';
import { and, eq, isNull, or, type SQL } from 'drizzle-orm';
import { Liquid } from 'liquidjs';
import { getErrorMessage } from 'src/common/utils/error.util';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import {
  TEMPLATE_MEMORY_LIMIT,
  TEMPLATE_PARSE_LIMIT,
  TEMPLATE_RENDER_LIMIT_MS,
  TEMPLATE_STANDARD,
} from './constants/template.constants';
import type {
  ReportContext,
  ReportTemplate,
  ReportTemplateInsert,
  ReportTemplateUpdate,
} from './template.interface';
import { TemplateRepository } from './template.repository';
import { reportTemplates } from './template.schema';

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

  constructor(private readonly templateRepository: TemplateRepository) {}

  find(filter?: SQL) {
    return this.templateRepository.find(filter);
  }

  findOne(filter: SQL) {
    return this.templateRepository.findOne(filter);
  }

  create(values: ReportTemplateInsert) {
    return this.templateRepository.create(values);
  }

  updateOne(filter: SQL, values: ReportTemplateUpdate) {
    return this.templateRepository.updateOne(filter, values);
  }

  deleteOne(filter: SQL) {
    return this.templateRepository.deleteOne(filter);
  }

  findById(id: string) {
    return this.findOne(eq(reportTemplates.id, id));
  }

  findAvailable(userId: string) {
    return this.find(or(isNull(reportTemplates.ownerId), eq(reportTemplates.ownerId, userId)));
  }

  findShared() {
    return this.find(isNull(reportTemplates.ownerId));
  }

  findSharedById(id: string) {
    return this.findOne(and(eq(reportTemplates.id, id), isNull(reportTemplates.ownerId))!);
  }

  deleteShared(id: string) {
    return this.deleteOne(and(eq(reportTemplates.id, id), isNull(reportTemplates.ownerId))!);
  }

  findOwn(userId: string) {
    return this.find(eq(reportTemplates.ownerId, userId));
  }

  deleteOwn(id: string, userId: string) {
    return this.deleteOne(and(eq(reportTemplates.id, id), eq(reportTemplates.ownerId, userId))!);
  }

  isAvailable(template: ReportTemplate, userId: string) {
    return template.ownerId === null || template.ownerId === userId;
  }

  check(body: string) {
    try {
      this.liquid.parse(body);
      return null;
    } catch (error) {
      return getErrorMessage(error);
    }
  }

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
