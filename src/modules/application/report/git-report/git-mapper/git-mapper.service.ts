import { Injectable } from '@nestjs/common';
import { GroupedDailyData } from '../git-group/git-group.interface';
import { MappedDailyData } from './git-mapper.interface';
import { GitMapperContextBuilder } from './git-mapper.context-builder';
import { GitMapperStatusResolver } from './git-mapper.status';
import { TaskStatus, TaskType } from 'src/common/enums/task.enum';
import { UserRole } from 'src/modules/application/user/user.enums';

//оркестратор: собирает контекст и резолвит статус для дневной активности
@Injectable()
export class GitMapperService {
  constructor(
    private readonly contextBuilder: GitMapperContextBuilder,
    private readonly statusResolver: GitMapperStatusResolver,
  ) {}

  mapDailyData(
    data: GroupedDailyData,
    username: string,
    currentUserGlobalRole: UserRole,
    reportDate: string,
  ): MappedDailyData {
    return {
      issues: data.issues.map((issue) => {
        const context = this.contextBuilder.buildIssueContext(
          issue,
          username,
          currentUserGlobalRole,
          reportDate,
        );
        return {
          ...issue,
          workResult: {
            status: this.statusResolver.resolve(context),
            taskType: context.taskType,
          },
        };
      }),
      standaloneMergeRequests: data.standaloneMergeRequests.map(
        (mergeRequest) => {
          const context =
            this.contextBuilder.buildStandaloneMergeRequestContext(
              mergeRequest,
              username,
              currentUserGlobalRole,
              reportDate,
            );
          return {
            ...mergeRequest,
            workResult: {
              status: this.statusResolver.resolve(context),
              taskType: context.taskType,
            },
          };
        },
      ),
      standalonePushes: data.standalonePushes.map((push) => ({
        ...push,
        workResult: {
          status: this.contextBuilder.isNewBranch(push)
            ? TaskStatus.STARTED
            : TaskStatus.CONTINUED,
          taskType: TaskType.UNKNOWN,
        },
      })),
    };
  }
}
