import { Controller, Post, Body } from '@nestjs/common';
import { ReportService } from '../../application/report/report.service';
import { ReportGenerateDto } from './dto/report-generate.dto';
import { ReportGenerateResponse } from './responses/report-generate.response';

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  async generateReport(
    @Body() dto: ReportGenerateDto,
  ): Promise<ReportGenerateResponse> {
    return this.reportService.generateReport(dto);
  }
}
