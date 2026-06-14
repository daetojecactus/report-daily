import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { UserStatus } from '../../user/user.enums';
import { BroadcastStep, BotCallbackAction } from '../bot-command.enums';
import { getErrorMessage } from 'src/common/helpers/error.helper';
import { Language, getLocale } from 'src/common/i18n/i18n';
import type { Locale } from 'src/common/i18n/i18n.types';
import { BroadcastQueueProducer } from 'src/modules/queue/broadcast/broadcast-queue.producer';
import type {
  CommandResult,
  InlineKeyboardMarkup,
} from '../bot-command.interface';

interface BroadcastSession {
  step: BroadcastStep;
  text?: string;
}

//визард рассылки сообщения всем активным пользователям
@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);
  private readonly sessions = new Map<number, BroadcastSession>();

  constructor(
    private readonly userService: UserService,
    private readonly broadcastQueueProducer: BroadcastQueueProducer,
  ) {}

  hasSession(ownerTelegramId: number): boolean {
    return this.sessions.has(ownerTelegramId);
  }

  //старт визарда: запрашиваем текст сообщения
  startWizard(
    ownerTelegramId: number,
    language: Language = Language.RU,
  ): CommandResult {
    const locale = getLocale(language);
    this.sessions.set(ownerTelegramId, { step: BroadcastStep.TEXT });
    return { text: locale.admin.broadcastEnterText };
  }

  //обработка введённого текста: показываем предпросмотр с кнопками
  handleTextInput(
    ownerTelegramId: number,
    text: string,
    locale: Locale,
  ): CommandResult | null {
    const session = this.sessions.get(ownerTelegramId);
    if (session?.step !== BroadcastStep.TEXT) return null;

    const message = text.trim();
    if (!message) {
      return { text: locale.admin.broadcastEmpty };
    }

    session.text = message;
    session.step = BroadcastStep.CONFIRM;

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: locale.admin.broadcastSend,
            callback_data: BotCallbackAction.BROADCAST_CONFIRM,
          },
          {
            text: locale.admin.broadcastCancel,
            callback_data: BotCallbackAction.BROADCAST_CANCEL,
          },
        ],
      ],
    };

    return {
      text: `${locale.admin.broadcastPreview}:\n\n${message}`,
      keyboard,
    };
  }

  //обработка кнопок предпросмотра (отправить / отмена)
  async handleCallback(
    ownerTelegramId: number,
    data: string,
    language: Language,
  ): Promise<CommandResult> {
    const locale = getLocale(language);
    const session = this.sessions.get(ownerTelegramId);

    if (data === BotCallbackAction.BROADCAST_CANCEL) {
      this.sessions.delete(ownerTelegramId);
      return { text: locale.admin.broadcastCancelled };
    }

    if (data !== BotCallbackAction.BROADCAST_CONFIRM) {
      return { text: locale.admin.unknownAction };
    }

    const message = session?.text?.trim();
    this.sessions.delete(ownerTelegramId);

    if (!message) {
      return { text: locale.admin.broadcastEmpty };
    }

    return this.enqueueBroadcast(message, locale);
  }

  //ставит рассылку в очередь всем активным получателям
  private async enqueueBroadcast(
    message: string,
    locale: Locale,
  ): Promise<CommandResult> {
    const users = await this.userService.find({ status: UserStatus.ACTIVE });
    const recipients = (users ?? []).filter((user) => user.telegramId);

    if (recipients.length === 0) {
      return { text: locale.admin.broadcastNoRecipients };
    }

    try {
      await this.broadcastQueueProducer.addBatchBroadcastJobs(
        recipients.map((user) => ({
          telegramId: user.telegramId,
          text: message,
        })),
      );
      return {
        text: `${locale.admin.broadcastQueued} ${recipients.length}`,
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      this.logger.error(`Broadcast enqueue failed: ${msg}`);
      return { text: `${locale.admin.reportError}: ${msg}` };
    }
  }
}
