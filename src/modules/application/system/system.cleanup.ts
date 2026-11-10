import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getToday } from 'src/common/utils/date.util';
import { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import { ReportService } from 'src/modules/application/report/report.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { SystemMessages } from './constants/system.messages';

@Injectable()
export class SystemCleanup {
  private readonly logger = new Logger(SystemCleanup.name);
  private readonly timeZone: string;

  constructor(
    private readonly reportService: ReportService,
    private readonly deliveryService: DeliveryService,
    configService: ConfigService<AppEnvs, true>,
  ) {
    this.timeZone = configService.get('APP_TIMEZONE', { infer: true });
  }

  async run() {
    const reports = await this.reportService.deleteExpired(getToday(this.timeZone));
    const deliveries = await this.deliveryService.deleteExpired(new Date());
    if (reports > 0 || deliveries > 0) {
      this.logger.log({ reports, deliveries }, SystemMessages.CLEANED);
    }
    return { reports, deliveries };
  }
}
