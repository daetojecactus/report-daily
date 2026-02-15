import { Controller, Post, Query } from '@nestjs/common';
import { ReportService } from 'src/modules/application/report/report.service';
import { SchedulerService } from 'src/modules/application/scheduler/scheduler.service';

@Controller('report')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly schedulerService: SchedulerService,
  ) {}

  //тест fallback (без AI)
  @Post('test/fallback')
  async testFallback(
    @Query('adminId') adminId: string,
    @Query('date') date: string,
  ) {
    const report = await this.reportService.generateReport(adminId, date);

    return {
      date: report.date,
      text: report.text,
      projects: report.projects,
    };
  }

  //тест с AI
  @Post('test/ai')
  async testAI(@Query('adminId') adminId: string, @Query('date') date: string) {
    const report = await this.reportService.generateReport(adminId, date);

    return {
      date: report.date,
      text: report.text,
      projects: report.projects,
    };
  }

  //тест отправки в Telegram
  @Post('test/send-telegram')
  async testSendTelegram(
    @Query('adminId') adminId: string,
    @Query('date') date?: string,
  ) {
    return await this.schedulerService.sendReportForUser(adminId, date);
  }

  //тест триггернуть крон вручную для текущего часа
  @Post('test/trigger-cron')
  async testTriggerCron() {
    const currentHour = new Date().getHours();
    const results = await this.schedulerService.sendReportsForHour(currentHour);
    return { hour: currentHour, total: results.length, results };
  }
}
