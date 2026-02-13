import { Controller, Post, Body } from '@nestjs/common';
import { ReportService } from '../../application/report/report.service';
import { ReportGenerateDto } from './dto/report-generate.dto';
import { ReportGenerateResponse } from './responses/report-generate.response';
import { GitGroupService } from 'src/modules/application/report/git-report/git-group/git-group.service';
import { GitMapperService } from 'src/modules/application/report/git-report/git-mapper/git-mapper.service';
import { UserRole } from 'src/modules/application/user/user.interface';

@Controller('report')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly gitGroupService: GitGroupService,
    private readonly gitMapperService: GitMapperService,
  ) {}

  @Post()
  async generateReport(
    @Body() dto: ReportGenerateDto,
  ): Promise<ReportGenerateResponse> {
    return this.reportService.generateReport(dto);
  }

  @Post('test')
  async test() {
    const username = 'dzubenko';
    const userId = 342;
    const dates = [
      '2026-02-09',
      '2026-02-10',
      '2026-02-11',
      '2026-02-12',
      '2026-02-13',
    ];

    const results: any[] = [];
    for (const date of dates) {
      const grouped = await this.gitGroupService.collectAndGroupDailyEvents(
        userId,
        date,
      );
      const mapped = this.gitMapperService.mapDailyData(
        grouped,
        username,
        UserRole.DEVELOPER,
        date,
      );
      results.push({
        date,
        issues: mapped.issues.map((i) => ({
          iid: i.iid,
          title: i.title,
          state: i.state,
          status: i.workResult.status,
          taskType: i.workResult.taskType,
          assignee: i.assignee,
          labels: i.labels,
          eventsCount: i.events.length,
          notesCount: i.notes.length,
          labelEventsCount: i.labelEvents.length,
          mergeRequests: i.mergeRequests.map((mr) => ({
            iid: mr.iid,
            state: mr.state,
            assignee: mr.assignee,
            reviewers: mr.reviewers,
            labels: mr.labels,
            eventsCount: mr.events.length,
            notesCount: mr.notes.length,
            events: mr.events.map((e) => e.actionName),
          })),
        })),
        standaloneMRs: mapped.standaloneMergeRequests.map((mr) => ({
          iid: mr.iid,
          title: mr.title,
          state: mr.state,
          status: mr.workResult.status,
          taskType: mr.workResult.taskType,
          assignee: mr.assignee,
          reviewers: mr.reviewers,
          labels: mr.labels,
          branch: mr.sourceBranch,
        })),
        standalonePushes: mapped.standalonePushes.map((p) => ({
          branch: p.branch,
          status: p.workResult.status,
          eventsCount: p.events.length,
          events: p.events.map((e) => ({
            action: e.actionName,
            pushAction: e.pushData?.action,
            refType: e.pushData?.refType,
          })),
        })),
      });
    }

    return results;
  }
}
