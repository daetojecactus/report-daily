import type { ChatEvent } from 'src/common/channel/types/chat-channel.interface';

export interface InboundEventJobData {
  event: ChatEvent;
}
