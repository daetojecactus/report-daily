import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ClassificationResult,
  ClassifiedDay,
  ClassifiedIssue,
} from 'src/modules/application/report/classification/classification.interface';
import { ClassificationService } from 'src/modules/application/report/classification/classification.service';
import { Source } from 'src/modules/application/source/source.enums';
import type {
  CleanEvent,
  GroupedIssue,
  GroupedMergeRequest,
  SourceAction,
} from 'src/modules/application/source/source.interface';
import { SourceService } from 'src/modules/application/source/source.service';
import { UserService } from 'src/modules/application/user/user.service';
import { UserSourceService } from 'src/modules/application/user/user-source/user-source.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { PREVIEW_INDENT } from './constants/preview.constants';

@Injectable()
export class PreviewService {
  constructor(
    private readonly configService: ConfigService<AppEnvs, true>,
    private readonly userService: UserService,
    private readonly userSourceService: UserSourceService,
    private readonly sourceService: SourceService,
    private readonly classificationService: ClassificationService,
  ) {}

  async describe(username: string, date: string) {
    const account = await this.userSourceService.findOneByUsername(Source.GITLAB, username);
    const user = account && (await this.userService.findById(account.userId));
    if (!account || !user) {
      return null;
    }
    const timeZone = user.timezone ?? this.configService.get('APP_TIMEZONE', { infer: true });
    const day = await this.classificationService.classify(
      await this.sourceService.collect(account, date, timeZone),
      account,
      user.role,
      date,
    );
    return [
      [account.username, user.role, date, timeZone].join(' · '),
      `issues: ${day.issues.length}, merge requests without an issue: ${day.standaloneMergeRequests.length}, pushes without a merge request: ${day.standalonePushes.length}`,
      ...this.describeDay(day),
    ].join('\n');
  }

  private describeDay(day: ClassifiedDay) {
    const items = [...day.issues, ...day.standaloneMergeRequests, ...day.standalonePushes];
    return [...new Set(items.map((item) => item.projectId))].flatMap((projectId) => [
      '',
      day.projects.find((project) => project.id === projectId)?.path ?? `project ${projectId}`,
      ...day.issues
        .filter((issue) => issue.projectId === projectId)
        .flatMap((issue) => this.describeIssue(issue, PREVIEW_INDENT)),
      ...day.standaloneMergeRequests
        .filter((mergeRequest) => mergeRequest.projectId === projectId)
        .flatMap((mergeRequest) =>
          this.describeMergeRequest(mergeRequest, PREVIEW_INDENT, mergeRequest.classification),
        ),
      ...day.standalonePushes
        .filter((push) => push.projectId === projectId)
        .flatMap((push) =>
          [
            `${PREVIEW_INDENT}Push ${push.branch}`,
            `${PREVIEW_INDENT.repeat(2)}${this.describeClassification(push.classification)}`,
            `${PREVIEW_INDENT.repeat(2)}events: ${this.describeEvents(push.events)}`,
            this.describeCommits(push.events) &&
              `${PREVIEW_INDENT.repeat(2)}${this.describeCommits(push.events)}`,
          ].filter(Boolean),
        ),
    ]);
  }

  private describeIssue(issue: ClassifiedIssue, indent: string): string[] {
    const closed = issue.closedOnReportDate ? ', closed on the day' : '';
    return [
      `${indent}Issue #${issue.iid} ${issue.title} · ${issue.state}${closed}`,
      `${indent}${PREVIEW_INDENT}${this.describeClassification(issue.classification)}`,
      ...this.describeDetails(issue, indent + PREVIEW_INDENT),
      ...issue.mergeRequests.flatMap((mergeRequest) =>
        this.describeMergeRequest(mergeRequest, indent + PREVIEW_INDENT),
      ),
    ];
  }

  private describeMergeRequest(
    mergeRequest: GroupedMergeRequest,
    indent: string,
    classification?: ClassificationResult,
  ): string[] {
    const draft = mergeRequest.draft ? ', draft' : '';
    const merged = mergeRequest.mergedOnReportDate ? ', merged on the day' : '';
    return [
      `${indent}MR !${mergeRequest.iid} ${mergeRequest.title} · ${mergeRequest.state}${draft}${merged} · ${mergeRequest.sourceBranch}`,
      ...(classification
        ? [`${indent}${PREVIEW_INDENT}${this.describeClassification(classification)}`]
        : []),
      ...this.describeDetails(mergeRequest, indent + PREVIEW_INDENT),
    ];
  }

  private describeClassification({ action, kind }: ClassificationResult) {
    return kind ? `action: ${action} (${kind})` : `action: ${action}`;
  }

  private describeDetails(item: GroupedIssue | GroupedMergeRequest, indent: string) {
    const comments = item.notes.filter((note) => !note.system).length;
    return [
      item.labels.length ? `labels: ${item.labels.join(', ')}` : '',
      item.assignees.length ? `assignees: ${item.assignees.join(', ')}` : '',
      'reviewers' in item && item.reviewers.length ? `reviewers: ${item.reviewers.join(', ')}` : '',
      'closesIssues' in item && item.closesIssues.length
        ? `closes: ${item.closesIssues.map((issue) => `#${issue.iid}`).join(', ')}`
        : '',
      'status' in item && item.status ? `status: ${item.status}` : '',
      item.actions.length ? `actions: ${this.describeActions(item.actions)}` : '',
      item.events.length ? `events: ${this.describeEvents(item.events)}` : '',
      this.describeCommits(item.events),
      comments ? `comments of the day: ${comments}` : '',
    ]
      .filter(Boolean)
      .map((line) => `${indent}${line}`);
  }

  private describeActions(actions: SourceAction[]) {
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
