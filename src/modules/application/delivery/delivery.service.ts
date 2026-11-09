import { Injectable } from '@nestjs/common';
import { eq, sql, type SQL } from 'drizzle-orm';
import type { Channel } from 'src/common/enums/channel.enums';
import type { Report } from 'src/modules/application/report/report.interface';
import { DeliveryKind, DeliveryStatus } from './delivery.enums';
import type { DeliveryInsert, DeliveryUpdate } from './delivery.interface';
import { DeliveryRepository } from './delivery.repository';
import { deliveries } from './delivery.schema';

@Injectable()
export class DeliveryService {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  find(filter?: SQL) {
    return this.deliveryRepository.find(filter);
  }

  findOne(filter: SQL) {
    return this.deliveryRepository.findOne(filter);
  }

  create(values: DeliveryInsert) {
    return this.deliveryRepository.create(values);
  }

  updateOne(filter: SQL, values: DeliveryUpdate) {
    return this.deliveryRepository.updateOne(filter, values);
  }

  findById(id: string) {
    return this.findOne(eq(deliveries.id, id));
  }

  createForReport(report: Report, channel: Channel) {
    return this.create({
      userId: report.userId,
      channel,
      kind: DeliveryKind.REPORT,
      reportId: report.id,
    });
  }

  countAttempt(id: string) {
    return this.updateOne(eq(deliveries.id, id), { attempts: sql`${deliveries.attempts} + 1` });
  }

  markSent(id: string, externalMessageId: string) {
    return this.updateOne(eq(deliveries.id, id), {
      status: DeliveryStatus.SENT,
      externalMessageId,
      error: null,
      sentAt: new Date(),
    });
  }

  markFailed(id: string, error: string) {
    return this.updateOne(eq(deliveries.id, id), { status: DeliveryStatus.FAILED, error });
  }
}
