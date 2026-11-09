import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getToday } from 'src/common/utils/date.util';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { ReportQueueProducer } from 'src/modules/queue/report/report-queue.producer';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotCommand } from '../bot.enums';
import type { BotContext, BotHandler, BotReply } from '../bot.interface';

@Injectable()
@BotSection({ access: BotAccess.EMPLOYEE, commands: [BotCommand.REPORT] })
export class ReportHandler implements BotHandler {
  constructor(
    private readonly configService: ConfigService<AppEnvs, true>,
    private readonly reportQueueProducer: ReportQueueProducer,
  ) {}

  async handle({ actor, locale }: BotContext): Promise<BotReply> {
    if (!actor.user) {
      return { screen: { text: locale.bot.forbidden } };
    }
    const timeZone = actor.user.timezone ?? this.configService.get('APP_TIMEZONE', { infer: true });
    await this.reportQueueProducer.addReport({
      userId: actor.user.id,
      date: getToday(timeZone),
      language: actor.language,
      reply: { channel: actor.channel, chatId: actor.chatId, externalId: actor.externalId },
    });
    return { screen: { text: locale.report.building } };
  }
}
