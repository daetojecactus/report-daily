import { Processor } from '@nestjs/bullmq';
import { ReportDelivery } from 'src/modules/application/bot/report/report.delivery';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { SlackService } from 'src/modules/vendors/slack/slack.service';
import { DELIVERY_SLACK_LIMITER, DELIVERY_SLACK_QUEUE } from './constants/delivery-queue.constants';
import { DeliveryQueueProcessor } from './delivery-queue.processor';

@Processor(DELIVERY_SLACK_QUEUE, { limiter: DELIVERY_SLACK_LIMITER })
export class DeliverySlackQueueProcessor extends DeliveryQueueProcessor {
  constructor(
    reportDelivery: ReportDelivery,
    channelService: ChannelService,
    protected readonly chatChannel: SlackService,
  ) {
    super(reportDelivery, channelService);
  }

  protected waitIfLimited() {
    return Promise.resolve();
  }
}
