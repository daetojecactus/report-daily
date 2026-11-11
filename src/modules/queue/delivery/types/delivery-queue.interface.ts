export interface DeliveryJobData {
  deliveryId: string;
}

export interface DeliveryBroadcastMessage {
  chatId: string;
  text: string;
}

export interface DeliveryBroadcastData extends DeliveryBroadcastMessage {
  broadcastId: string;
}
