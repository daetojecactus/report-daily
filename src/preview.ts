import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DefaultMessages } from './common/constants/default.messages';
import { toDate } from './common/utils/date.util';
import type {
  CleanEvent,
  GroupedDailyData,
  GroupedIssue,
  GroupedMergeRequest,
} from './modules/application/report/source/source.interface';
import { SourceService } from './modules/application/report/source/source.service';
import { UserService } from './modules/application/user/user.service';
import type { AppEnvs } from './modules/infrastructure/config/config.env';
import { PreviewModule } from './modules/preview.module';

const INDENT = '  ';

function describeEvents(events: CleanEvent[]) {
  return [...Map.groupBy(events, (event) => event.actionName)]
    .map(([action, { length }]) =>
      length > 1 ? `${action} x${length}` : action,
    )
    .join(', ');
}

function describeDetails(
  item: GroupedIssue | GroupedMergeRequest,
  indent: string,
) {
  const comments = item.notes.filter((note) => !note.system).length;
  return [
    item.labels.length ? `labels: ${item.labels.join(', ')}` : '',
    item.assignees.length ? `assignees: ${item.assignees.join(', ')}` : '',
    'reviewers' in item && item.reviewers.length
      ? `reviewers: ${item.reviewers.join(', ')}`
      : '',
    'closesIssues' in item && item.closesIssues.length
      ? `closes: ${item.closesIssues.map((issue) => `#${issue.iid}`).join(', ')}`
      : '',
    item.events.length ? `events: ${describeEvents(item.events)}` : '',
    comments ? `comments of the day: ${comments}` : '',
  ]
    .filter(Boolean)
    .map((line) => `${indent}${line}`);
}

function describeMergeRequest(
  mergeRequest: GroupedMergeRequest,
  indent: string,
): string[] {
  const draft = mergeRequest.draft ? ', draft' : '';
  const merged = mergeRequest.mergedOnReportDate ? ', merged on the day' : '';
  return [
    `${indent}MR !${mergeRequest.iid} ${mergeRequest.title} · ${mergeRequest.state}${draft}${merged} · ${mergeRequest.sourceBranch}`,
    ...describeDetails(mergeRequest, indent + INDENT),
  ];
}

function describeIssue(issue: GroupedIssue, indent: string): string[] {
  const closed = issue.closedOnReportDate ? ', closed on the day' : '';
  return [
    `${indent}Issue #${issue.iid} ${issue.title} · ${issue.state}${closed}`,
    ...describeDetails(issue, indent + INDENT),
    ...issue.mergeRequests.flatMap((mergeRequest) =>
      describeMergeRequest(mergeRequest, indent + INDENT),
    ),
  ];
}

function describeDay(day: GroupedDailyData) {
  const items = [
    ...day.issues,
    ...day.standaloneMergeRequests,
    ...day.standalonePushes,
  ];
  return [...new Set(items.map((item) => item.projectId))].flatMap(
    (projectId) => [
      '',
      day.projects.find((project) => project.id === projectId)?.path ??
        `project ${projectId}`,
      ...day.issues
        .filter((issue) => issue.projectId === projectId)
        .flatMap((issue) => describeIssue(issue, INDENT)),
      ...day.standaloneMergeRequests
        .filter((mergeRequest) => mergeRequest.projectId === projectId)
        .flatMap((mergeRequest) => describeMergeRequest(mergeRequest, INDENT)),
      ...day.standalonePushes
        .filter((push) => push.projectId === projectId)
        .flatMap((push) => [
          `${INDENT}Push ${push.branch}`,
          `${INDENT}${INDENT}events: ${describeEvents(push.events)}`,
        ]),
    ],
  );
}

const [username = '', dateText = ''] = process.argv.slice(2);
const date = toDate(dateText);
if (!username || !date) {
  Logger.error(DefaultMessages.PREVIEW_USAGE);
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(PreviewModule, {
  logger: ['error', 'warn'],
});
try {
  const user = await app.get(UserService).findByGitlabUsername(username);
  if (!user) {
    Logger.error(`${DefaultMessages.PREVIEW_EMPLOYEE_NOT_FOUND}: ${username}`);
    process.exitCode = 1;
  } else {
    const timeZone =
      user.timezone ??
      app
        .get<ConfigService<AppEnvs, true>>(ConfigService)
        .get('APP_TIMEZONE', { infer: true });
    const day = await app
      .get(SourceService)
      .collect(user.gitlabUserId, date, timeZone);
    const lines = [
      [user.gitlabUsername, user.role, date, timeZone].join(' · '),
      `issues: ${day.issues.length}, merge requests without an issue: ${day.standaloneMergeRequests.length}, pushes without a merge request: ${day.standalonePushes.length}`,
      ...describeDay(day),
    ];
    process.stdout.write(`${lines.join('\n')}\n`);
  }
} catch (error) {
  Logger.error(DefaultMessages.PREVIEW_FAILED, error);
  process.exitCode = 1;
} finally {
  await app.close();
}
