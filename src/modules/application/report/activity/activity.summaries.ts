import { Injectable } from '@nestjs/common';
import type { SourceProject } from 'src/modules/application/source/types/source-day.interface';
import {
  ACTIVITY_SUMMARY_ACROSS_KEY,
  ACTIVITY_SUMMARY_ACTIONS,
  ACTIVITY_SUMMARY_MIN_LINES,
  ACTIVITY_SUMMARY_MIN_PROJECTS,
} from './constants/activity.constants';
import { ActivityAction, ActivityDetail } from './types/activity.enums';
import type { ActivityLine, ActivityResult, ActivitySummary } from './types/activity.interface';

@Injectable()
export class ActivitySummaries {
  collect(results: ActivityResult[], projects: SourceProject[]): ActivitySummary[] {
    const groups = new Map<string, ActivityResult[]>();
    for (const result of results.filter((item) => this.isSummarized(item))) {
      const { action, details } = result.choice.main;
      const place = this.isAcrossProjects(result)
        ? [ACTIVITY_SUMMARY_ACROSS_KEY, this.toSharedName(result) ?? '']
        : [this.findProjectId(result.line)];
      const key = [...place, action, ...details.toSorted()].join('|');
      groups.set(key, [...(groups.get(key) ?? []), result]);
    }
    return [...groups.values()].flatMap((group) => this.toSummary(group, projects));
  }

  private toSummary(group: ActivityResult[], projects: SourceProject[]): ActivitySummary[] {
    const [first] = group;
    const across = this.isAcrossProjects(first);
    const projectIds = [...new Set(group.map((result) => this.findProjectId(result.line)))];
    if (
      group.length < ACTIVITY_SUMMARY_MIN_LINES ||
      (across && projectIds.length < ACTIVITY_SUMMARY_MIN_PROJECTS)
    ) {
      return [];
    }
    return [
      {
        action: first.choice.main.action,
        details: first.choice.main.details,
        results: group,
        projects: across
          ? projectIds.map((projectId) => {
              const project = projects.find((item) => item.id === projectId);
              return project?.name || project?.path || String(projectId);
            })
          : null,
      },
    ];
  }

  private isAcrossProjects(result: ActivityResult) {
    return (
      result.choice.main.details.includes(ActivityDetail.DEPENDENCIES) ||
      this.toSharedName(result) !== null
    );
  }

  private toSharedName({ line, choice }: ActivityResult) {
    if (line.issue || choice.main.details.includes(ActivityDetail.DEPENDENCIES)) {
      return null;
    }
    return line.mergeRequests.at(0)?.title ?? line.pushes.at(0)?.ref ?? null;
  }

  findProjectId(line: ActivityLine) {
    return (
      line.issue?.projectId ??
      line.mergeRequests.at(0)?.projectId ??
      line.pushes.at(0)?.projectId ??
      line.event?.projectId ??
      null
    );
  }

  private isSummarized(result: ActivityResult) {
    const { choice, excluded } = result;
    return (
      !excluded &&
      (ACTIVITY_SUMMARY_ACTIONS.has(choice.main.action) || this.isAcrossProjects(result)) &&
      choice.secondary.every((candidate) => candidate.action === ActivityAction.STATE_ONLY)
    );
  }
}
