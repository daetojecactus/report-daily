import { Injectable } from '@nestjs/common';
import type { DayRange } from 'src/common/interfaces/date.interface';
import { isWithinDay } from 'src/common/utils/date.util';
import type { GitLabNote, GitLabProject } from 'src/modules/vendors/gitlab/gitlab.interface';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import {
  GITLAB_SOURCE_LINK_KINDS,
  GITLAB_SOURCE_LINK_WINDOW_MS,
} from './constants/gitlab-source.constants';
import { GitLabSourceDetails } from './gitlab-source.details';
import type { DayActivity, SourceLinkReference } from './gitlab-source.interface';
import { GitLabSourceKeys } from './gitlab-source.keys';
import { GitLabSourceNotes } from './gitlab-source.notes';

@Injectable()
export class GitLabSourceLinks {
  constructor(
    private readonly gitlabService: GitLabService,
    private readonly gitlabSourceDetails: GitLabSourceDetails,
    private readonly gitlabSourceNotes: GitLabSourceNotes,
    private readonly gitlabSourceKeys: GitLabSourceKeys,
  ) {}

  async addSources(activity: DayActivity, employeeId: number, day: DayRange): Promise<DayActivity> {
    const paths = new Map(
      activity.projects.map((project) => [project.id, project.path_with_namespace]),
    );
    const known = new Set(
      activity.issues.map(({ issue }) => `${paths.get(issue.project_id)}#${issue.iid}`),
    );
    const wanted = new Map<string, SourceLinkReference>();
    for (const { issue, notes } of activity.issues) {
      const path = paths.get(issue.project_id);
      for (const note of path ? this.toOwnLinks(notes, employeeId, day) : []) {
        for (const reference of this.gitlabSourceKeys.toIssueReferences(note.body, path ?? '')) {
          const key = `${reference.path}#${reference.iid}`;
          if (!known.has(key)) {
            const entry = wanted.get(key) ?? { ...reference, times: [] };
            entry.times.push(Date.parse(note.created_at));
            wanted.set(key, entry);
          }
        }
      }
    }
    const projects = new Map<string, Promise<GitLabProject | null>>();
    const sources = (
      await Promise.all(
        [...wanted.values()].map((reference) =>
          this.loadSource(reference, employeeId, day, projects),
        ),
      )
    ).filter((source) => source !== null);
    const added = new Map(
      sources
        .map(({ project }) => project)
        .filter((project) => !paths.has(project.id))
        .map((project) => [project.id, project]),
    );
    return {
      ...activity,
      projects: [...activity.projects, ...added.values()],
      issues: [...activity.issues, ...sources.map(({ issue }) => issue)],
    };
  }

  private async loadSource(
    { path, iid, times }: SourceLinkReference,
    employeeId: number,
    day: DayRange,
    projects: Map<string, Promise<GitLabProject | null>>,
  ) {
    if (!projects.has(path)) {
      projects.set(path, this.gitlabService.findProjectByPath(path));
    }
    const project = await projects.get(path);
    const found = project ? await this.gitlabService.findIssue(project.id, iid) : null;
    if (!project || !found) {
      return null;
    }
    const issue = await this.gitlabSourceDetails.loadIssueActivity(found, [], []);
    const isSource = this.toOwnLinks(issue.notes, employeeId, day).some((note) =>
      times.some(
        (time) => Math.abs(Date.parse(note.created_at) - time) <= GITLAB_SOURCE_LINK_WINDOW_MS,
      ),
    );
    return isSource ? { project, issue } : null;
  }

  private toOwnLinks(notes: GitLabNote[], employeeId: number, day: DayRange) {
    return notes.filter((note) => {
      const kind = this.gitlabSourceNotes.match(note)?.kind;
      return (
        note.author.id === employeeId &&
        isWithinDay(note.created_at, day) &&
        kind !== undefined &&
        GITLAB_SOURCE_LINK_KINDS.has(kind)
      );
    });
  }
}
