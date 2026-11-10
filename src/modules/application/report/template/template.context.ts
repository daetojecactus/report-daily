import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import type { Gender } from 'src/modules/application/user/user.enums';
import { ActivityTier } from '../activity/activity.enums';
import type { ActivityLine, ActivityResult, ActivitySummary } from '../activity/activity.interface';
import { ActivityService } from '../activity/activity.service';
import { PhraseService } from '../phrase/phrase.service';
import {
  TEMPLATE_CONTEXT_VERSION,
  TEMPLATE_DATE_FORMAT,
  TEMPLATE_DATE_TIME_SUFFIX,
  TEMPLATE_WEEKDAY_FORMAT,
} from './constants/template.constants';
import { TemplateItemType } from './template.enums';
import type {
  ReportContext,
  TemplateBuild,
  TemplateDay,
  TemplateItem,
  TemplateProject,
} from './template.interface';

interface TemplateEntry {
  projectId: number | null;
  weight: number;
  item: TemplateItem;
}

@Injectable()
export class TemplateContext {
  constructor(
    private readonly configService: ConfigService<AppEnvs, true>,
    private readonly activityService: ActivityService,
    private readonly phraseService: PhraseService,
  ) {}

  build(day: TemplateDay, locale: Locale): ReportContext {
    return this.buildWithSources(day, locale).context;
  }

  buildWithSources(
    { date, language, employee, day, results, summaries }: TemplateDay,
    locale: Locale,
  ): TemplateBuild {
    const projectName = (projectId: number | null) => {
      const project = day.projects.find((item) => item.id === projectId);
      return project?.name ?? project?.path ?? '';
    };
    const summaryOf = new Map(
      summaries.flatMap((summary) => summary.results.map((result) => [result, summary] as const)),
    );
    const placed = new Set<ActivitySummary>();
    const entries: TemplateEntry[] = [];
    const sources = new Map<TemplateItem, ActivityResult>();
    for (const result of results.filter((item) => !item.excluded)) {
      const projectId = this.activityService.findProjectId(result.line);
      const summary = summaryOf.get(result);
      if (summary && !placed.has(summary)) {
        placed.add(summary);
        entries.push({
          projectId,
          weight: this.toWeight(result),
          item: this.toSummaryItem(summary, employee.gender, locale, projectName(projectId)),
        });
      } else if (!summary) {
        const item = this.toItem(result, employee.gender, locale, projectName(projectId));
        sources.set(item, result);
        entries.push({ projectId, weight: this.toWeight(result), item });
      }
    }
    const sorted = entries.toSorted((left, right) => right.weight - left.weight);
    const projects: TemplateProject[] = [...new Set(entries.map((entry) => entry.projectId))].map(
      (projectId) => {
        const project = day.projects.find((item) => item.id === projectId);
        return {
          name: projectName(projectId),
          url: this.toUrl(project?.webUrl ?? null),
          items: sorted.filter((entry) => entry.projectId === projectId).map((entry) => entry.item),
        };
      },
    );
    const items = projects.flatMap((project) => project.items);
    const at = new Date(`${date}${TEMPLATE_DATE_TIME_SUFFIX}`);
    const context: ReportContext = {
      version: TEMPLATE_CONTEXT_VERSION,
      date,
      dateText: new Intl.DateTimeFormat(locale.phrases.dateLocale, TEMPLATE_DATE_FORMAT).format(at),
      weekday: new Intl.DateTimeFormat(locale.phrases.dateLocale, TEMPLATE_WEEKDAY_FORMAT).format(
        at,
      ),
      language,
      user: {
        name: employee.name,
        username: employee.username,
        role: employee.role,
        roleName: locale.roles[employee.role],
      },
      isEmpty: items.length === 0,
      itemsCount: items.length,
      projects,
      items,
      groups: Object.values(ActivityTier)
        .map((category) => ({
          category,
          name: locale.phrases.categories[category],
          items: items.filter((item) => item.category === category),
        }))
        .filter((group) => group.items.length > 0),
      ai: { used: false },
    };
    return { context, sources };
  }

  private toItem(
    result: ActivityResult,
    gender: Gender,
    locale: Locale,
    projectName: string,
  ): TemplateItem {
    const { line, signals, choice } = result;
    const parts = this.phraseService.compose(result, gender, locale);
    return {
      ...parts,
      action: choice.main.action,
      details: choice.main.details,
      secondary: choice.secondary.map(({ action, details }) => ({ action, details })),
      category: this.toCategory(result),
      kind: signals.kind,
      priority: signals.priority,
      state: signals.endStates.at(-1) ?? null,
      type: this.toType(line),
      ref: this.phraseService.findReference(line) ?? line.pushes.at(0)?.ref ?? null,
      url: this.toUrl(line.issue?.webUrl ?? line.mergeRequests.at(0)?.webUrl ?? null),
      projectName,
    };
  }

  private toSummaryItem(
    summary: ActivitySummary,
    gender: Gender,
    locale: Locale,
    projectName: string,
  ): TemplateItem {
    const text = this.phraseService.summarize(summary, gender, locale);
    const [first] = summary.results;
    return {
      text,
      actionText: text,
      note: null,
      title: null,
      action: summary.action,
      details: summary.details,
      secondary: [],
      category: this.toCategory(first),
      kind: null,
      priority: null,
      state: null,
      type: TemplateItemType.SUMMARY,
      ref: null,
      url: null,
      projectName,
    };
  }

  private toCategory({ choice }: ActivityResult) {
    return (
      choice.trace.ranked.find(({ candidate }) => candidate === choice.main)?.tier ??
      ActivityTier.CONTEXT
    );
  }

  private toWeight({ choice }: ActivityResult) {
    return choice.trace.ranked.find(({ candidate }) => candidate === choice.main)?.weight ?? 0;
  }

  private toType(line: ActivityLine) {
    if (line.issue) {
      return TemplateItemType.ISSUE;
    }
    if (line.mergeRequests.length) {
      return TemplateItemType.MERGE_REQUEST;
    }
    return line.event ? TemplateItemType.EVENT : TemplateItemType.PUSH;
  }

  private toUrl(url: string | null) {
    const gitlabUrl = this.configService.get('GITLAB_URL', { infer: true });
    return url && URL.canParse(url) && new URL(url).origin === new URL(gitlabUrl).origin
      ? url
      : null;
  }
}
