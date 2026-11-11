import { Injectable, Logger } from '@nestjs/common';
import type { DayRange } from 'src/common/types/date.interface';
import { isWithinDay } from 'src/common/utils/date.util';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import { GitLabIssuable } from 'src/modules/vendors/gitlab/types/gitlab.enums';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import {
  GITLAB_SOURCE_INDEX_KEY,
  GITLAB_SOURCE_INDEX_SCHEMA,
  GITLAB_SOURCE_INDEX_TTL_MS,
  GITLAB_SOURCE_LOOKBACK_DAYS,
  GITLAB_SOURCE_SCAN_LIMIT,
} from './constants/gitlab-source.constants';
import { GitLabSourceMessages } from './constants/gitlab-source.messages';
import type { SourceDayIndex, SourceHiddenItems } from './types/gitlab-source.interface';

@Injectable()
export class GitLabSourceScanner {
  private readonly logger = new Logger(GitLabSourceScanner.name);

  constructor(
    private readonly gitlabService: GitLabService,
    private readonly redisService: RedisService,
  ) {}

  async findHiddenItems(
    gitlabUserId: number,
    date: string,
    day: DayRange,
  ): Promise<SourceHiddenItems> {
    const projectIds = await this.gitlabService.findRecentProjectIds(
      gitlabUserId,
      date,
      GITLAB_SOURCE_LOOKBACK_DAYS,
    );
    const indexes = await Promise.all(
      projectIds.map(
        async (projectId) => [projectId, await this.loadIndex(projectId, day)] as const,
      ),
    );
    const found: SourceHiddenItems = { issues: [], mergeRequests: [] };
    for (const [projectId, index] of indexes) {
      const own = index[String(gitlabUserId)];
      found.issues.push(...(own?.issues ?? []).map((iid) => ({ projectId, iid })));
      found.mergeRequests.push(...(own?.mergeRequests ?? []).map((iid) => ({ projectId, iid })));
    }
    return found;
  }

  private async loadIndex(projectId: number, day: DayRange) {
    const key = [GITLAB_SOURCE_INDEX_KEY, projectId, day.start].join(':');
    const cached = await this.redisService.get(key);
    if (cached) {
      const parsed = GITLAB_SOURCE_INDEX_SCHEMA.safeParse(this.parseJson(cached));
      if (parsed.success) {
        return parsed.data;
      }
      this.logger.warn({ projectId }, GitLabSourceMessages.INDEX_INVALID);
    }
    const index = await this.buildIndex(projectId, day);
    await this.redisService.set(key, JSON.stringify(index), GITLAB_SOURCE_INDEX_TTL_MS);
    return index;
  }

  private async buildIndex(projectId: number, day: DayRange) {
    const updatedAfter = new Date(day.start).toISOString();
    const [issues, mergeRequests] = await Promise.all([
      this.gitlabService.findUpdatedItems(GitLabIssuable.ISSUES, projectId, updatedAfter),
      this.gitlabService.findUpdatedItems(GitLabIssuable.MERGE_REQUESTS, projectId, updatedAfter),
    ]);
    const items = [
      ...issues.map(({ iid }) => ({ issuable: GitLabIssuable.ISSUES, iid })),
      ...mergeRequests.map(({ iid }) => ({
        issuable: GitLabIssuable.MERGE_REQUESTS,
        iid,
      })),
    ];
    if (items.length > GITLAB_SOURCE_SCAN_LIMIT) {
      this.logger.warn({ projectId, items: items.length }, GitLabSourceMessages.SCAN_LIMIT_REACHED);
    }

    const index: SourceDayIndex = {};
    await Promise.all(
      items.slice(0, GITLAB_SOURCE_SCAN_LIMIT).map(async ({ issuable, iid }) => {
        const issue = issuable === GitLabIssuable.ISSUES;
        const [notes, ...events] = await Promise.all([
          this.gitlabService.findNotes(issuable, projectId, iid),
          this.gitlabService.findLabelEvents(issuable, projectId, iid),
          issue ? this.gitlabService.findMilestoneEvents(issuable, projectId, iid) : [],
          issue ? this.gitlabService.findIterationEvents(projectId, iid) : [],
          issue ? this.gitlabService.findWeightEvents(projectId, iid) : [],
        ]);
        const userIds = new Set([
          ...notes
            .filter((note) => isWithinDay(note.created_at, day))
            .map((note) => note.author.id),
          ...events
            .flat()
            .filter((event) => isWithinDay(event.created_at, day))
            .map((event) => event.user.id),
        ]);
        for (const userId of userIds) {
          const own = (index[String(userId)] ??= {
            issues: [],
            mergeRequests: [],
          });
          (issue ? own.issues : own.mergeRequests).push(iid);
        }
      }),
    );
    for (const own of Object.values(index)) {
      own.issues.sort((left, right) => left - right);
      own.mergeRequests.sort((left, right) => left - right);
    }
    return index;
  }

  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}
