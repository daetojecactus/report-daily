import { Injectable, Logger } from '@nestjs/common';
import { ReportService } from '../report.service';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { ReportMessages } from '../constants/report.messages';
import { Language, getLocale } from 'src/common/i18n/i18n';
import type { ReportRecipient } from '../report.interface';

//единая точка «сгенерировать и отправить отчёт»
//используется и планировщиком, и обработчиком очереди — логика пустого отчёта должна совпадать
@Injectable()
export class ReportDeliveryService {
  private readonly logger = new Logger(ReportDeliveryService.name);

  constructor(
    private readonly reportService: ReportService,
    private readonly telegramService: TelegramService,
  ) {}

  //бросает наверх: вызывающий сам решает, ретраить или считать попытку проваленной
  async deliver(recipient: ReportRecipient, date: string): Promise<void> {
    const { adminId, telegramId, language } = recipient;
    const report = await this.reportService.generateReport(adminId, date);

    if (!report.text || report.projects.length === 0) {
      this.logger.warn(`${ReportMessages.REPORT_EMPTY}: ${adminId}`);
      const locale = getLocale(language ?? Language.RU);
      await this.telegramService.sendMessageTo(
        telegramId,
        locale.report.noActivity,
      );
      return;
    }

    await this.telegramService.sendMessageTo(telegramId, report.text);
  }
}
