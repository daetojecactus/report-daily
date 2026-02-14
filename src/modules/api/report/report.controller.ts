import { Controller, Post } from '@nestjs/common';
import { ReportService } from 'src/modules/application/report/report.service';
import {
  UserGender,
  UserRole,
} from 'src/modules/application/user/user.interface';

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  //тест fallback (без AI) за 13 февраля
  @Post('test/fallback')
  async testFallback() {
    const report = await this.reportService.generateReport({
      gitLabUserId: 342,
      username: 'dzubenko',
      userRole: UserRole.DEVELOPER,
      gender: UserGender.MALE,
      date: '2026-02-13',
      useAI: false,
    });

    return {
      date: report.date,
      text: report.text,
      projects: report.projects,
    };
  }

  //тест с AI за 13 февраля
  @Post('test/ai')
  async testAI() {
    const report = await this.reportService.generateReport({
      gitLabUserId: 342,
      username: 'dzubenko',
      userRole: UserRole.DEVELOPER,
      gender: UserGender.MALE,
      date: '2026-02-13',
      useAI: true,
    });

    return {
      date: report.date,
      text: report.text,
      projects: report.projects,
    };
  }
}
