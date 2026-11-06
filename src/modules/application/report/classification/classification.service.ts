import { Injectable } from '@nestjs/common';
import type {
  GroupedDailyData,
  StandalonePush,
} from 'src/modules/application/source/source.interface';
import { TraitService } from 'src/modules/application/trait/trait.service';
import type { UserSource } from 'src/modules/application/user/user-source/user-source.interface';
import type { JobRole } from 'src/modules/application/user/user.enums';
import {
  CLASSIFICATION_BRANCH_REF_TYPE,
  CLASSIFICATION_NEW_BRANCH_ACTION,
} from './constants/classification.constants';
import { ClassificationBuilder } from './classification.builder';
import type { TaskContext } from './classification.context';
import { ActivityAction } from './classification.enums';
import type { ClassificationResult, ClassifiedDay } from './classification.interface';
import { ClassificationResolver } from './classification.resolver';

@Injectable()
export class ClassificationService {
  constructor(
    private readonly traitService: TraitService,
    private readonly classificationBuilder: ClassificationBuilder,
    private readonly classificationResolver: ClassificationResolver,
  ) {}

  async classify(
    day: GroupedDailyData,
    account: UserSource,
    role: JobRole,
    reportDate: string,
  ): Promise<ClassifiedDay> {
    const index = await this.traitService.loadIndex(account.source, role);
    const employee = { username: account.username, role };
    return {
      projects: day.projects,
      issues: day.issues.map((issue) => ({
        ...issue,
        classification: this.toResult(
          this.classificationBuilder.buildIssueContext(issue, employee, index, reportDate),
        ),
      })),
      standaloneMergeRequests: day.standaloneMergeRequests.map((mergeRequest) => ({
        ...mergeRequest,
        classification: this.toResult(
          this.classificationBuilder.buildMergeRequestContext(
            mergeRequest,
            employee,
            index,
            reportDate,
          ),
        ),
      })),
      standalonePushes: day.standalonePushes.map((push) => ({
        ...push,
        classification: {
          action: this.isNewBranch(push) ? ActivityAction.STARTED : ActivityAction.CONTINUED,
          kind: null,
        },
      })),
    };
  }

  private toResult(context: TaskContext): ClassificationResult {
    return { action: this.classificationResolver.resolve(context), kind: context.kind };
  }

  private isNewBranch(push: StandalonePush) {
    return push.events.some(
      (event) =>
        event.pushData?.action === CLASSIFICATION_NEW_BRANCH_ACTION &&
        event.pushData.refType === CLASSIFICATION_BRANCH_REF_TYPE,
    );
  }
}
