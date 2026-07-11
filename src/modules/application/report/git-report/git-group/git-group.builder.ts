import { Injectable } from '@nestjs/common';
import {
  GitLabCommit,
  GitLabEvent,
  GitLabIssue,
  GitLabLabelEvent,
  GitLabMergeRequest,
  GitLabNote,
  GitLabStateEvent,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import { MainBranch, ParsedEventType } from 'src/common/enums/gitlab.enum';
import {
  CleanEvent,
  CleanLabelEvent,
  CleanNote,
  GroupedDailyData,
  GroupedIssue,
  GroupedMergeRequest,
  StandaloneMergeRequest,
  StandalonePush,
} from './git-group.interface';
import { detectEventType, toKey } from './git-group.event-parser';

//сборка сгруппированных данных: распределение событий и формирование задач/мр/пушей
@Injectable()
export class GitGroupBuilder {
  //собирает сгруппированные данные из событий
  buildGroupedData(
    events: GitLabEvent[],
    issuesMap: Map<string, GitLabIssue>,
    mrsMap: Map<string, GitLabMergeRequest>,
    mrToIssueLinks: Map<string, string>,
    issueNotesMap: Map<string, GitLabNote[]>,
    issueLabelEventsMap: Map<string, GitLabLabelEvent[]>,
    mrNotesMap: Map<string, GitLabNote[]>,
    mrLabelEventsMap: Map<string, GitLabLabelEvent[]>,
    issueStateEventsMap: Map<string, GitLabStateEvent[]>,
    mrStateEventsMap: Map<string, GitLabStateEvent[]>,
    mrCommitsMap: Map<string, GitLabCommit[]>,
    date: string,
  ): GroupedDailyData {
    const eventsByIssue = this.initializeEventsMap(issuesMap.keys());
    const eventsByMr = this.initializeEventsMap(mrsMap.keys());
    const eventsByPush = new Map<string, GitLabEvent[]>();

    this.distributeEvents(events, eventsByIssue, eventsByMr, eventsByPush);
    this.injectPushEventsIntoMrs(eventsByPush, eventsByMr, mrsMap);

    return {
      issues: this.assembleGroupedIssues(
        issuesMap,
        eventsByIssue,
        mrsMap,
        eventsByMr,
        mrToIssueLinks,
        issueNotesMap,
        issueLabelEventsMap,
        mrNotesMap,
        mrLabelEventsMap,
        issueStateEventsMap,
        mrStateEventsMap,
        mrCommitsMap,
        date,
      ),
      standaloneMergeRequests: this.assembleStandaloneMergeRequests(
        mrsMap,
        eventsByMr,
        mrToIssueLinks,
        mrNotesMap,
        mrLabelEventsMap,
        mrStateEventsMap,
        mrCommitsMap,
        date,
      ),
      standalonePushes: this.assembleStandalonePushes(
        eventsByPush,
        mrsMap,
        date,
      ),
    };
  }

  //инициализирует пустые массивы событий для каждого ключа
  private initializeEventsMap(keys: IterableIterator<string>) {
    const map = new Map<string, GitLabEvent[]>();
    for (const key of keys) {
      map.set(key, []);
    }
    return map;
  }

  //распределяет события по задачам, мр и пушам
  private distributeEvents(
    events: GitLabEvent[],
    eventsByIssue: Map<string, GitLabEvent[]>,
    eventsByMr: Map<string, GitLabEvent[]>,
    eventsByPush: Map<string, GitLabEvent[]>,
  ) {
    for (const event of events) {
      const parsed = detectEventType(event);

      if (parsed.type === ParsedEventType.ISSUE && parsed.iid) {
        eventsByIssue.get(toKey(parsed.projectId, parsed.iid))?.push(event);
      } else if (parsed.type === ParsedEventType.MERGE_REQUEST && parsed.iid) {
        eventsByMr.get(toKey(parsed.projectId, parsed.iid))?.push(event);
      } else if (parsed.type === ParsedEventType.PUSH && parsed.branch) {
        const key = `${parsed.projectId}_${parsed.branch}`;
        const existing = eventsByPush.get(key) ?? [];
        existing.push(event);
        eventsByPush.set(key, existing);
      }
    }
  }

  //переносит push-события в связанные мр (push на ветку мр = коммиты мр)
  private injectPushEventsIntoMrs(
    eventsByPush: Map<string, GitLabEvent[]>,
    eventsByMr: Map<string, GitLabEvent[]>,
    mrsMap: Map<string, GitLabMergeRequest>,
  ) {
    const branchToMrKey = new Map<string, string>();
    for (const [mrKey, mr] of mrsMap) {
      branchToMrKey.set(`${mr.project_id}_${mr.source_branch}`, mrKey);
    }

    for (const [pushKey, pushEvents] of eventsByPush) {
      const mrKey = branchToMrKey.get(pushKey);
      if (!mrKey) continue;

      const mrEvents = eventsByMr.get(mrKey);
      if (mrEvents) {
        mrEvents.push(...pushEvents);
      }
    }
  }

  //собирает задачи с вложенными мр
  private assembleGroupedIssues(
    issuesMap: Map<string, GitLabIssue>,
    eventsByIssue: Map<string, GitLabEvent[]>,
    mrsMap: Map<string, GitLabMergeRequest>,
    eventsByMr: Map<string, GitLabEvent[]>,
    mrToIssueLinks: Map<string, string>,
    issueNotesMap: Map<string, GitLabNote[]>,
    issueLabelEventsMap: Map<string, GitLabLabelEvent[]>,
    mrNotesMap: Map<string, GitLabNote[]>,
    mrLabelEventsMap: Map<string, GitLabLabelEvent[]>,
    issueStateEventsMap: Map<string, GitLabStateEvent[]>,
    mrStateEventsMap: Map<string, GitLabStateEvent[]>,
    mrCommitsMap: Map<string, GitLabCommit[]>,
    date: string,
  ): GroupedIssue[] {
    return Array.from(issuesMap.entries()).map(([issueKey, issue]) => ({
      projectId: issue.project_id,
      iid: issue.iid,
      title: issue.title,
      state: this.resolveStateAsOfDate(
        issue.state,
        issueStateEventsMap.get(issueKey) ?? [],
        date,
      ) as GroupedIssue['state'],
      webUrl: issue.web_url,
      labels: issue.labels,
      createdAt: issue.created_at,
      assignee: issue.assignee?.username ?? null,
      events: this.cleanEvents(eventsByIssue.get(issueKey) ?? [], date),
      notes: this.cleanNotes(issueNotesMap.get(issueKey) ?? [], date),
      labelEvents: this.cleanLabelEvents(
        issueLabelEventsMap.get(issueKey) ?? [],
        date,
      ),
      mergeRequests: this.findRelatedMergeRequests(
        issueKey,
        mrsMap,
        eventsByMr,
        mrToIssueLinks,
        mrNotesMap,
        mrLabelEventsMap,
        mrStateEventsMap,
        mrCommitsMap,
        date,
      ),
    }));
  }

  //находит мр связанные с задачей
  private findRelatedMergeRequests(
    issueKey: string,
    mrsMap: Map<string, GitLabMergeRequest>,
    eventsByMr: Map<string, GitLabEvent[]>,
    mrToIssueLinks: Map<string, string>,
    mrNotesMap: Map<string, GitLabNote[]>,
    mrLabelEventsMap: Map<string, GitLabLabelEvent[]>,
    mrStateEventsMap: Map<string, GitLabStateEvent[]>,
    mrCommitsMap: Map<string, GitLabCommit[]>,
    date: string,
  ): GroupedMergeRequest[] {
    const related: GroupedMergeRequest[] = [];

    for (const [mrKey, linkedIssueKey] of mrToIssueLinks) {
      if (linkedIssueKey !== issueKey) continue;

      const mr = mrsMap.get(mrKey)!;
      related.push({
        projectId: mr.project_id,
        iid: mr.iid,
        title: mr.title,
        state: this.resolveStateAsOfDate(
          mr.state,
          mrStateEventsMap.get(mrKey) ?? [],
          date,
        ) as GroupedMergeRequest['state'],
        webUrl: mr.web_url,
        sourceBranch: mr.source_branch,
        labels: mr.labels,
        createdAt: mr.created_at,
        lastCommitAt: this.resolveLastCommitBeforeDate(
          mrCommitsMap.get(mrKey) ?? [],
          date,
        ),
        author: mr.author?.username ?? null,
        assignee: mr.assignee?.username ?? null,
        reviewers: this.resolveReviewers(mr, mrNotesMap.get(mrKey) ?? []),
        events: this.cleanEvents(eventsByMr.get(mrKey) ?? [], date),
        notes: this.cleanNotes(mrNotesMap.get(mrKey) ?? [], date),
        labelEvents: this.cleanLabelEvents(
          mrLabelEventsMap.get(mrKey) ?? [],
          date,
        ),
      });
    }

    return related;
  }

  //собирает мр без привязки к задачам
  private assembleStandaloneMergeRequests(
    mrsMap: Map<string, GitLabMergeRequest>,
    eventsByMr: Map<string, GitLabEvent[]>,
    mrToIssueLinks: Map<string, string>,
    mrNotesMap: Map<string, GitLabNote[]>,
    mrLabelEventsMap: Map<string, GitLabLabelEvent[]>,
    mrStateEventsMap: Map<string, GitLabStateEvent[]>,
    mrCommitsMap: Map<string, GitLabCommit[]>,
    date: string,
  ): StandaloneMergeRequest[] {
    return Array.from(mrsMap.entries())
      .filter(([mrKey]) => !mrToIssueLinks.has(mrKey))
      .map(([mrKey, mr]) => ({
        projectId: mr.project_id,
        iid: mr.iid,
        title: mr.title,
        state: this.resolveStateAsOfDate(
          mr.state,
          mrStateEventsMap.get(mrKey) ?? [],
          date,
        ) as StandaloneMergeRequest['state'],
        webUrl: mr.web_url,
        sourceBranch: mr.source_branch,
        labels: mr.labels,
        createdAt: mr.created_at,
        lastCommitAt: this.resolveLastCommitBeforeDate(
          mrCommitsMap.get(mrKey) ?? [],
          date,
        ),
        author: mr.author?.username ?? null,
        assignee: mr.assignee?.username ?? null,
        reviewers: this.resolveReviewers(mr, mrNotesMap.get(mrKey) ?? []),
        events: this.cleanEvents(eventsByMr.get(mrKey) ?? [], date),
        notes: this.cleanNotes(mrNotesMap.get(mrKey) ?? [], date),
        labelEvents: this.cleanLabelEvents(
          mrLabelEventsMap.get(mrKey) ?? [],
          date,
        ),
      }));
  }

  //ревьюеры мр: текущие + исторические (кого когда-либо назначали ревьюером)
  //история важна: пользователь мог отревьюить и быть снят с ревью до формирования отчёта
  private resolveReviewers(
    mr: GitLabMergeRequest,
    notes: GitLabNote[],
  ): string[] {
    const current = mr.reviewers?.map((reviewer) => reviewer.username) ?? [];
    const historical = this.extractHistoricalReviewers(notes);
    return [...new Set([...current, ...historical])];
  }

  //извлекает из системных комментариев всех, кого просили провести ревью
  //системный комментарий gitlab: "requested review from @user1 and @user2"
  private extractHistoricalReviewers(notes: GitLabNote[]): string[] {
    const reviewers: string[] = [];

    for (const note of notes) {
      if (!note.system || !note.body) continue;
      if (!note.body.toLowerCase().startsWith('requested review from')) {
        continue;
      }

      const mentions = note.body.match(/@([a-zA-Z0-9._-]+)/g);
      if (!mentions) continue;

      for (const mention of mentions) {
        reviewers.push(mention.slice(1));
      }
    }

    return reviewers;
  }

  //собирает пуши без привязки к мр (исключает main/master/develop)
  private assembleStandalonePushes(
    eventsByPush: Map<string, GitLabEvent[]>,
    mrsMap: Map<string, GitLabMergeRequest>,
    date: string,
  ): StandalonePush[] {
    const mrBranches = new Set(
      Array.from(mrsMap.values()).map(
        (mr) => `${mr.project_id}_${mr.source_branch}`,
      ),
    );
    const mainBranches = new Set(Object.values(MainBranch) as string[]);

    return Array.from(eventsByPush.entries())
      .filter(([key]) => {
        if (mrBranches.has(key)) return false;
        const [, ...branchParts] = key.split('_');
        const branch = branchParts.join('_');
        //фильтруем пуши в main/master/develop — это артефакты мержа
        if (mainBranches.has(branch)) return false;
        return true;
      })
      .map(([key, events]) => {
        const [projectId, ...branchParts] = key.split('_');
        return {
          projectId: parseInt(projectId, 10),
          branch: branchParts.join('_'),
          events: this.cleanEvents(events, date),
        };
      });
  }

  //очищает события от лишних данных и фильтрует за указанный день
  private cleanEvents(events: GitLabEvent[], date: string): CleanEvent[] {
    const { start, end } = this.getDayRange(date);

    return events
      .filter((event) => {
        const eventDate = new Date(event.created_at);
        return eventDate >= start && eventDate <= end;
      })
      .map((event) => ({
        id: event.id,
        projectId: event.project_id,
        actionName: event.action_name,
        targetType: event.target_type,
        targetTitle: event.target_title,
        createdAt: event.created_at,
        pushData: event.push_data
          ? {
              commitCount: event.push_data.commit_count,
              action: event.push_data.action,
              refType: event.push_data.ref_type,
              ref: event.push_data.ref,
              commitTitle: event.push_data.commit_title,
            }
          : undefined,
        noteBody: event.note?.body,
      }));
  }

  //очищает комментарии и фильтрует за указанный день
  private cleanNotes(notes: GitLabNote[], date: string): CleanNote[] {
    const { start, end } = this.getDayRange(date);

    return notes
      .filter((note) => {
        const noteDate = new Date(note.created_at);
        return noteDate >= start && noteDate <= end;
      })
      .map((note) => ({
        id: note.id,
        body: note.body,
        authorUsername: note.author.username,
        authorName: note.author.name,
        createdAt: note.created_at,
        system: note.system,
        noteableType: note.noteable_type,
        resolvable: note.resolvable,
        resolved: note.resolved,
      }));
  }

  //очищает события лейблов и фильтрует за указанный день
  private cleanLabelEvents(
    labelEvents: GitLabLabelEvent[],
    date: string,
  ): CleanLabelEvent[] {
    const { start, end } = this.getDayRange(date);

    return labelEvents
      .filter((event) => {
        const eventDate = new Date(event.created_at);
        return eventDate >= start && eventDate <= end;
      })
      .map((event) => ({
        id: event.id,
        labelName: event.label.name,
        action: event.action,
        createdAt: event.created_at,
        username: event.user.username,
      }));
  }

  /**
   * Восстанавливает состояние (state) задачи/MR на конец указанного дня.
   * Берет все state-events до конца дня (включительно) и возвращает
   * state последнего из них. Если до конца дня нет ни одного события —
   * возвращаем 'opened' (начальное состояние в GitLab).
   */
  private resolveStateAsOfDate(
    currentState: string,
    stateEvents: GitLabStateEvent[],
    date: string,
  ): string {
    if (!stateEvents.length) {
      return currentState;
    }

    const { end } = this.getDayRange(date);

    const eventsBeforeDate = stateEvents
      .filter((event) => new Date(event.created_at) <= end)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

    if (!eventsBeforeDate.length) {
      return 'opened';
    }

    const lastState = eventsBeforeDate[eventsBeforeDate.length - 1].state;
    //reopened → opened для совместимости с GitLabIssueState/GitLabMergeRequestState
    return lastState === 'reopened' ? 'opened' : lastState;
  }

  //вычисляет границы дня (начало и конец) из строковой даты
  private getDayRange(date: string): { start: Date; end: Date } {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  //дата последнего коммита строго до начала дня отчёта
  //нужна для определения возобновления работы (разрыв между коммитами)
  private resolveLastCommitBeforeDate(
    commits: GitLabCommit[],
    date: string,
  ): string | null {
    const { start } = this.getDayRange(date);

    const previousCommitTimes = commits
      .map((commit) => commit.committed_date ?? commit.created_at)
      .map((commitDate) => new Date(commitDate).getTime())
      .filter((time) => !Number.isNaN(time) && time < start.getTime());

    if (!previousCommitTimes.length) return null;

    return new Date(Math.max(...previousCommitTimes)).toISOString();
  }
}
