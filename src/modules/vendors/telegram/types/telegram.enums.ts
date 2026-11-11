export enum TelegramMethod {
  GET_UPDATES = 'getUpdates',
  DELETE_WEBHOOK = 'deleteWebhook',
  SEND_MESSAGE = 'sendMessage',
  EDIT_MESSAGE_TEXT = 'editMessageText',
  ANSWER_CALLBACK_QUERY = 'answerCallbackQuery',
  SET_MY_COMMANDS = 'setMyCommands',
  DELETE_MY_COMMANDS = 'deleteMyCommands',
}

export enum TelegramUpdateType {
  MESSAGE = 'message',
  CALLBACK_QUERY = 'callback_query',
}

export enum TelegramParseMode {
  HTML = 'HTML',
}

export enum TelegramScopeType {
  ALL_PRIVATE_CHATS = 'all_private_chats',
  CHAT = 'chat',
}
