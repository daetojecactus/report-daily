import type { Screen } from 'src/common/channel/types/chat-channel.interface';

export interface ReportDeliveryPlan {
  deliveryId: string;
  reportId: string;
  chatId: string;
  screen: Screen;
}
