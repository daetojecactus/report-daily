import { Injectable } from '@nestjs/common';
import type { ProjectReport, ReportLine } from '../report.interface';
import { Language, getLocale } from 'src/common/i18n/i18n';
import { QA_SECTIONS } from './constants/report-template.constants';
import { ReportTemplate } from '../../user/user.enums';

@Injectable()
export class ReportTemplateService {
  //форматирует текстовый отчет по выбранному шаблону
  formatText(
    projects: ProjectReport[],
    template: ReportTemplate,
    language: Language,
  ): string {
    switch (template) {
      case ReportTemplate.QA:
        return this.formatQAText(projects, language);
      case ReportTemplate.STANDARD:
      default:
        return this.formatStandardText(projects);
    }
  }

  //стандартный шаблон: project:\n• description\n\nproject2:\n• description
  private formatStandardText(projects: ProjectReport[]): string {
    return projects
      .map((project) => {
        const lines = project.lines
          .map((line) => `• ${line.description}`)
          .join('\n');
        return `${project.projectName}:\n${lines}`;
      })
      .join('\n\n');
  }

  //QA шаблон: секции по типу работы, внутри — [PROJECT] описание
  private formatQAText(projects: ProjectReport[], language: Language): string {
    const locale = getLocale(language);

    //собираем все строки с именем проекта
    const allLines: { projectName: string; line: ReportLine }[] = [];
    for (const project of projects) {
      for (const line of project.lines) {
        allLines.push({ projectName: project.projectName, line });
      }
    }

    //группируем по секциям
    const sections: { title: string; items: string[] }[] = [];
    const used = new Set<number>();

    for (const section of QA_SECTIONS) {
      const items: string[] = [];
      allLines.forEach(({ projectName, line }, index) => {
        if (!used.has(index) && section.statuses.has(line.status)) {
          items.push(`[${projectName.toUpperCase()}]\n${line.description}`);
          used.add(index);
        }
      });
      if (items.length > 0) {
        sections.push({ title: section.titleKey(locale), items });
      }
    }

    //оставшиеся задачи → «Прочее»
    const other: string[] = [];
    allLines.forEach(({ projectName, line }, index) => {
      if (!used.has(index)) {
        other.push(`[${projectName.toUpperCase()}]\n${line.description}`);
      }
    });
    if (other.length > 0) {
      sections.push({ title: locale.report.qaOther, items: other });
    }

    return sections
      .map((section) => `${section.title}\n\n${section.items.join('\n\n')}`)
      .join('\n\n');
  }
}
