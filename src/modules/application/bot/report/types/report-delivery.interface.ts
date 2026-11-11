import type { Screen } from 'src/common/channel/types/chat-channel.interface';

export interface ReportDeliveryPlan {
  deliveryId: string;
  reportId: string;
  chatIds: string[];
  redirected: boolean;
  screen: Screen;
}
