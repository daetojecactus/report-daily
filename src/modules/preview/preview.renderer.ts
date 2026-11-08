import { Injectable } from '@nestjs/common';
import type {
  ActivityCandidate,
  ActivityResult,
  ActivitySummary,
} from 'src/modules/application/report/activity/activity.interface';
import { SourceRefType, WorkItemType } from 'src/modules/application/source/source.enums';
import type {
  CleanEvent,
  GroupedDailyData,
  GroupedIssue,
  GroupedMergeRequest,
  SourceFact,
  StandalonePush,
} from 'src/modules/application/source/source.interface';
import {
  PREVIEW_HOUR_SECONDS,
  PREVIEW_INDENT,
  PREVIEW_MINUTE_SECONDS,
  PREVIEW_REASONS,
  PREVIEW_TARGET_NAMES,
} from './constants/preview.constants';

@Injectable()
export class PreviewRenderer {
  render(
    day: GroupedDailyData,
    results: ActivityResult[],
    trace: boolean,
    summaries: ActivitySummary[] = [],
  ) {
    const summarized = new Set(summaries.flatMap((summary) => summary.results));
    const items = [
      ...day.issues,
      ...day.standaloneMergeRequests,
      ...day.standalonePushes,
      ...day.standaloneEvents,
    ];
    const resultOf = (item: (typeof items)[number]) =>
      results.find(
        ({ line }) =>
          line.issue === item ||
          line.event === item ||
          (line.issue === null && (line.mergeRequests[0] ?? line.pushes[0]) === item),
      );
    const describe = (item: (typeof items)[number]) => {
      const result = resultOf(item);
      return result
        ? this.describeResult(result, PREVIEW_INDENT.repeat(2), trace, summarized.has(result))
        : [];
    };
    const projects = [...new Set(items.map((item) => item.projectId))].flatMap((projectId) => [
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
        .flatMap((push) => this.describePush(push, PREVIEW_INDENT, describe(push))),
      ...day.standaloneEvents
        .filter((item) => item.projectId === projectId)
        .flatMap((item) => [
          `${PREVIEW_INDENT}${PREVIEW_TARGET_NAMES[item.targetType]} ${item.title}`,
          ...describe(item),
          `${PREVIEW_INDENT.repeat(2)}events: ${this.describeEvents(item.events)}`,
        ]),
    ]);
    return [...projects, ...this.describeSummaries(day, summaries)];
  }

  private describeSummaries(day: GroupedDailyData, summaries: ActivitySummary[]) {
    if (!summaries.length) {
      return [];
    }
    const pathOf = (projectId: number) =>
      day.projects.find((project) => project.id === projectId)?.path ?? `project ${projectId}`;
    const refOf = ({ line }: ActivityResult) => {
      const mergeRequest = line.mergeRequests.at(0);
      if (line.issue) {
        return `${pathOf(line.issue.projectId)}#${line.issue.iid}`;
      }
      if (mergeRequest) {
        return `${pathOf(mergeRequest.projectId)}!${mergeRequest.iid}`;
      }
      return line.event?.title ?? line.pushes.at(0)?.ref ?? '';
    };
    return [
      '',
      'Summaries',
      ...summaries.map(
        ({ action, details, results }) =>
          `${PREVIEW_INDENT}${[action, details.join(', ')].filter(Boolean).join(' · ')} x${results.length}: ${results.map(refOf).join(', ')}`,
      ),
    ];
  }

  private describeResult(
    { choice, excluded }: ActivityResult,
    indent: string,
    trace: boolean,
    summarized: boolean,
  ) {
    const main = `${indent}main: ${this.describeCandidate(choice.main)}${excluded ? ' · excluded from the report' : ''}${summarized ? ' · in a summary' : ''}`;
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
      ...issue.pushes.flatMap((push) => this.describePush(push, PREVIEW_INDENT.repeat(2))),
    ];
  }

  private describePush(push: StandalonePush, indent: string, result: string[] = []) {
    return [
      `${indent}${this.describeRef(push)}`,
      ...result,
      `${indent}${PREVIEW_INDENT}events: ${this.describeEvents(push.events)}`,
      this.describeCommits(push.events) &&
        `${indent}${PREVIEW_INDENT}${this.describeCommits(push.events)}`,
    ].filter(Boolean);
  }

  private describeRef({ ref, refType, mainBranch, events }: StandalonePush) {
    const tag = refType === SourceRefType.TAG;
    if (ref === null) {
      const count = Math.max(0, ...events.map((event) => event.pushData?.refCount ?? 0));
      return `Bulk push · ${count} ${tag ? 'tags' : 'branches'}`;
    }
    return `${tag ? 'Tag' : 'Push'} ${ref}${mainBranch ? ' · main branch' : ''}`;
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
      'workItemType' in item && item.workItemType && item.workItemType !== WorkItemType.ISSUE
        ? `type: ${item.workItemType}`
        : '',
      item.labels.length ? `labels: ${item.labels.join(', ')}` : '',
      item.assignees.length ? `assignees: ${item.assignees.join(', ')}` : '',
      'reviewers' in item && item.reviewers.length ? `reviewers: ${item.reviewers.join(', ')}` : '',
      'closesIssues' in item && item.closesIssues.length
        ? `closes: ${item.closesIssues.map((issue) => `#${issue.iid}`).join(', ')}`
        : '',
      'status' in item && item.status ? `status: ${item.status}` : '',
      item.milestone ? `milestone: ${item.milestone}` : '',
      'iteration' in item && item.iteration ? `iteration: ${item.iteration}` : '',
      'weight' in item && item.weight !== null ? `weight: ${item.weight}` : '',
      item.timeSpent ? `time spent: ${this.describeDuration(item.timeSpent)}` : '',
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

  private describeDuration(seconds: number) {
    const hours = Math.floor(seconds / PREVIEW_HOUR_SECONDS);
    const minutes = Math.round((seconds % PREVIEW_HOUR_SECONDS) / PREVIEW_MINUTE_SECONDS);
    return [hours ? `${hours}h` : '', minutes ? `${minutes}m` : ''].filter(Boolean).join(' ');
  }

  private countRepeats(texts: string[]) {
    return [...Map.groupBy(texts, (text) => text)]
      .map(([text, { length }]) => (length > 1 ? `${text} x${length}` : text))
      .join(', ');
  }
}
