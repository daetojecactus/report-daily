import { Controller, Post, Query } from '@nestjs/common';
import { ReportService } from 'src/modules/application/report/report.service';
import { SchedulerService } from 'src/modules/application/scheduler/scheduler.service';
import { UserRole } from 'src/modules/application/user/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import { PortalService } from 'src/modules/vendors/portal/portal.service';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { OWNER_BOT_COMMANDS } from 'src/modules/application/bot-command/constants/bot-command.constants';
import { ConfigService } from '@nestjs/config';
import type { ReportDailyBotEnvs } from 'src/config/env';

@Controller('report')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly schedulerService: SchedulerService,
    private readonly portalService: PortalService,
    private readonly gitLabService: GitLabService,
    private readonly userService: UserService,
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
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

  @Post('test/logs-portal')
  async testLogsPortal() {
    const test = await this.portalService.findUserByEmail(
      'milana.kadushina@ps.kz',
    );
    console.log('🌵 => test:', test);
    return test;
  }

  @Post('test/logs-git')
  async testLogsGit() {
    const test = await this.gitLabService.findUserByUsername('agranevsky');
    console.log('🌵 => test:', test);
    return test;
  }

  @Post('test/off-users')
  async testOffUsers() {
    const test = await this.portalService.getUserAbsencesForDate('237');
    console.log('🌵 => test:', test);
    return test;
  }

  @Post('test/today-off-users')
  async getTodayOffUsers() {
    const test = await this.portalService.getTodayOffUsers();
    console.log('🌵 => test:', test);
    return test;
  }

  @Post('test/create-user')
  async createUser(
    @Query('adminId') adminId: string,
    @Query('telegramId') telegramId: number,
    @Query('reportHour') reportHour: number,
    @Query('role') role: string,
  ) {
    const user = await this.userService.createUser({
      adminId,
      telegramId,
      reportHour,
      role: role as UserRole,
    });
    console.log('🌵 => user:', user);

    return user;
  }

  //устанавливает команды бота только для owner из env
  //все остальные пользователи не видят команды в меню
  @Post('test/setup-owner-commands')
  async setupOwnerCommands() {
    const ownerTelegramId = this.configService.get('OWNER_TELEGRAM_ID');
    await this.telegramService.setCommandsForChat(
      ownerTelegramId,
      OWNER_BOT_COMMANDS,
    );
    return { ok: true, ownerTelegramId, commands: OWNER_BOT_COMMANDS };
  }
}
