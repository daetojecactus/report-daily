import { Injectable } from '@nestjs/common';
import type {
  ActivityCandidate,
  ActivityResult,
} from 'src/modules/application/report/activity/activity.interface';
import type {
  CleanEvent,
  GroupedDailyData,
  GroupedIssue,
  GroupedMergeRequest,
  SourceFact,
  StandalonePush,
} from 'src/modules/application/source/source.interface';
import { PREVIEW_INDENT, PREVIEW_REASONS } from './constants/preview.constants';

@Injectable()
export class PreviewRenderer {
  render(day: GroupedDailyData, results: ActivityResult[], trace: boolean) {
    const items = [...day.issues, ...day.standaloneMergeRequests, ...day.standalonePushes];
    const resultOf = (item: GroupedIssue | GroupedMergeRequest | StandalonePush) =>
      results.find(
        ({ line }) =>
          line.issue === item ||
          line.push === item ||
          (line.issue === null && line.mergeRequests[0] === item),
      );
    const describe = (item: GroupedIssue | GroupedMergeRequest | StandalonePush) => {
      const result = resultOf(item);
      return result ? this.describeResult(result, PREVIEW_INDENT.repeat(2), trace) : [];
    };
    return [...new Set(items.map((item) => item.projectId))].flatMap((projectId) => [
      '',
      day.projects.find((project) => project.id === projectId)?.path ?? `project ${projectId}`,
      ...day.issues
        .filter((issue) => issue.projectId === projectId)
        .flatMap((issue) => this.describeIssue(issue, describe(issue))),
      ...day.standaloneMergeRequests
        .filter((mergeRequest) => mergeRequest.projectId === projectId)
        .flatMap((mergeRequest) =>
          this.describeMergeRequest(mergeRequest, PREVIEW_INDENT, describe(mergeRequest)),
        ),
      ...day.standalonePushes
        .filter((push) => push.projectId === projectId)
        .flatMap((push) =>
          [
            `${PREVIEW_INDENT}Push ${push.branch}`,
            ...describe(push),
            `${PREVIEW_INDENT.repeat(2)}events: ${this.describeEvents(push.events)}`,
            this.describeCommits(push.events) &&
              `${PREVIEW_INDENT.repeat(2)}${this.describeCommits(push.events)}`,
          ].filter(Boolean),
        ),
    ]);
  }

  private describeResult({ choice, excluded }: ActivityResult, indent: string, trace: boolean) {
    const main = `${indent}main: ${this.describeCandidate(choice.main)}${excluded ? ' · excluded from the report' : ''}`;
    if (!trace) {
      return [main];
    }
    return [
      main,
      `${indent}trace: ${PREVIEW_REASONS[choice.trace.reason]}`,
      ...choice.trace.ranked.map(({ candidate, tier, weight }, place) => {
        const parts = candidate.parts.length
          ? ` ← ${candidate.parts.map((part) => part.action).join(', ')}`
          : '';
        return `${indent}${PREVIEW_INDENT}${place + 1}. ${this.describeCandidate(candidate)} (${tier}, ${weight})${parts}`;
      }),
      ...(choice.trace.dropped.length
        ? [
            `${indent}dropped: ${this.countRepeats(
              choice.trace.dropped.map(({ fact, rule }) => `${fact.kind} (${rule})`),
            )}`,
          ]
        : []),
    ];
  }

  private describeCandidate({ action, state, details }: ActivityCandidate) {
    return [[action, state].filter(Boolean).join(' '), details.join(', ')]
      .filter(Boolean)
      .join(' · ');
  }

  private describeIssue(issue: GroupedIssue, result: string[]): string[] {
    const closed = issue.closedOnReportDate ? ', closed on the day' : '';
    return [
      `${PREVIEW_INDENT}Issue #${issue.iid} ${issue.title} · ${issue.state}${closed}`,
      ...result,
      ...this.describeDetails(issue, PREVIEW_INDENT.repeat(2)),
      ...issue.mergeRequests.flatMap((mergeRequest) =>
        this.describeMergeRequest(mergeRequest, PREVIEW_INDENT.repeat(2)),
      ),
    ];
  }

  private describeMergeRequest(
    mergeRequest: GroupedMergeRequest,
    indent: string,
    result: string[] = [],
  ): string[] {
    const draft = mergeRequest.draft ? ', draft' : '';
    const merged = mergeRequest.mergedOnReportDate ? ', merged on the day' : '';
    return [
      `${indent}MR !${mergeRequest.iid} ${mergeRequest.title} · ${mergeRequest.state}${draft}${merged} · ${mergeRequest.sourceBranch}`,
      ...result,
      ...this.describeDetails(mergeRequest, indent + PREVIEW_INDENT),
    ];
  }

  private describeDetails(item: GroupedIssue | GroupedMergeRequest, indent: string) {
    const comments = item.notes.filter((note) => !note.system).length;
    const own = item.facts.filter((fact) => fact.own);
    const others = item.facts.filter((fact) => !fact.own);
    return [
      item.labels.length ? `labels: ${item.labels.join(', ')}` : '',
      item.assignees.length ? `assignees: ${item.assignees.join(', ')}` : '',
      'reviewers' in item && item.reviewers.length ? `reviewers: ${item.reviewers.join(', ')}` : '',
      'closesIssues' in item && item.closesIssues.length
        ? `closes: ${item.closesIssues.map((issue) => `#${issue.iid}`).join(', ')}`
        : '',
      'status' in item && item.status ? `status: ${item.status}` : '',
      own.length ? `actions: ${this.describeActions(own)}` : '',
      others.length ? `facts of others: ${others.length}` : '',
      this.describeStartOfDay(item),
      item.events.length ? `events: ${this.describeEvents(item.events)}` : '',
      this.describeCommits(item.events),
      comments ? `comments of the day: ${comments}` : '',
    ]
      .filter(Boolean)
      .map((line) => `${indent}${line}`);
  }

  private describeStartOfDay({ state, labels, startOfDay }: GroupedIssue | GroupedMergeRequest) {
    const added = labels.filter((label) => !startOfDay.labels.includes(label));
    const removed = startOfDay.labels.filter((label) => !labels.includes(label));
    if (startOfDay.state === state && !added.length && !removed.length) {
      return '';
    }
    return [
      `start of day: ${startOfDay.state}`,
      added.length ? `labels added: ${added.join(', ')}` : '',
      removed.length ? `labels removed: ${removed.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  private describeActions(actions: SourceFact[]) {
    return this.countRepeats(
      actions.map(({ kind, value, users }) =>
        [kind, value, ...users.map((user) => `@${user}`)].filter(Boolean).join(' '),
      ),
    );
  }

  private describeEvents(events: CleanEvent[]) {
    return this.countRepeats(events.map((event) => event.actionName));
  }

  private describeCommits(events: CleanEvent[]) {
    const commits = events.flatMap((event) => event.pushData?.commits ?? []);
    return commits.length ? `commits: ${commits.map((commit) => commit.title).join('; ')}` : '';
  }

  private countRepeats(texts: string[]) {
    return [...Map.groupBy(texts, (text) => text)]
      .map(([text, { length }]) => (length > 1 ? `${text} x${length}` : text))
      .join(', ');
  }
}
