import type { GitLabEvent } from 'src/modules/vendors/gitlab/gitlab.interface';
import {
  GitLabNoteableType,
  GitLabTargetType,
  MainBranch,
  ParsedEventType,
} from 'src/common/enums/gitlab.enum';
import { GIT_REPORT_BRANCH_ISSUE_PATTERN } from '../constants/git-report.constants';
import { ParsedEvent } from './git-group.interface';

//формирует уникальный ключ из projectId и iid
export function toKey(projectId: number, iid: number): string {
  return `${projectId}_${iid}`;
}

//парсит ключ обратно в projectId и iid
export function fromKey(key: string): { projectId: number; iid: number } {
  const [projectId, iid] = key.split('_').map(Number);
  return { projectId, iid };
}

//проверяет связано ли событие с задачей
export function isIssueRelated(event: GitLabEvent): boolean {
  return (
    event.target_type === GitLabTargetType.ISSUE ||
    event.target_type === GitLabTargetType.WORK_ITEM ||
    (event.target_type === GitLabTargetType.NOTE &&
      (event.note?.noteable_type === GitLabNoteableType.ISSUE ||
        event.note?.noteable_type === GitLabNoteableType.WORK_ITEM))
  );
}

//проверяет связано ли событие с мр
export function isMergeRequestRelated(event: GitLabEvent): boolean {
  return (
    event.target_type === GitLabTargetType.MERGE_REQUEST ||
    (event.target_type === GitLabTargetType.NOTE &&
      event.note?.noteable_type === GitLabNoteableType.MERGE_REQUEST) ||
    (event.target_type === GitLabTargetType.DIFF_NOTE &&
      event.note?.noteable_type === GitLabNoteableType.MERGE_REQUEST)
  );
}

//определяет тип события (задача, мр, пуш)
export function detectEventType(event: GitLabEvent): ParsedEvent {
  const projectId = event.project_id;

  if (isIssueRelated(event)) {
    const iid = event.note?.noteable_iid ?? event.target_iid;
    return { type: ParsedEventType.ISSUE, projectId, iid };
  }

  if (isMergeRequestRelated(event)) {
    const iid = event.note?.noteable_iid ?? event.target_iid;
    return { type: ParsedEventType.MERGE_REQUEST, projectId, iid };
  }

  if (event.push_data) {
    return {
      type: ParsedEventType.PUSH,
      projectId,
      branch: event.push_data.ref,
    };
  }

  return { type: ParsedEventType.UNKNOWN, projectId };
}

//извлекает уникальные ключи задач и мр из событий
export function extractUniqueKeys(events: GitLabEvent[]): {
  issueKeys: Set<string>;
  mrKeys: Set<string>;
} {
  const issueKeys = new Set<string>();
  const mrKeys = new Set<string>();

  for (const event of events) {
    const parsed = detectEventType(event);

    if (parsed.type === ParsedEventType.ISSUE && parsed.iid) {
      issueKeys.add(toKey(parsed.projectId, parsed.iid));
    } else if (parsed.type === ParsedEventType.MERGE_REQUEST && parsed.iid) {
      mrKeys.add(toKey(parsed.projectId, parsed.iid));
    }
  }

  return { issueKeys, mrKeys };
}

//извлекает номер задачи из названия ветки (101-feat-update -> 101)
export function extractIssueIdFromBranch(branchName: string): number | null {
  const match = branchName.match(GIT_REPORT_BRANCH_ISSUE_PATTERN);
  return match ? parseInt(match[1], 10) : null;
}

//собирает уникальные feature-ветки из пуш-событий (не main/master/develop)
export function collectPushBranches(
  events: GitLabEvent[],
): { projectId: number; branch: string }[] {
  const mainBranches = new Set(Object.values(MainBranch) as string[]);
  const seen = new Set<string>();
  const result: { projectId: number; branch: string }[] = [];

  for (const event of events) {
    if (!event.push_data?.ref) continue;
    const branch = event.push_data.ref;
    if (mainBranches.has(branch)) continue;

    const key = `${event.project_id}_${branch}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({ projectId: event.project_id, branch });
  }

  return result;
}
