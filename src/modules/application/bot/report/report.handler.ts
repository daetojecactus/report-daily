import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatInputType } from 'src/common/enums/channel.enums';
import { addDays, getToday } from 'src/common/utils/date.util';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import { ReportQueueProducer } from 'src/modules/queue/report/report-queue.producer';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotCommand, BotNamespace } from '../bot.enums';
import type { BotActor, BotContext, BotHandler, BotReply } from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import {
  REPORT_BUTTON_SCHEMA,
  REPORT_DAYS_BACK,
  REPORT_REBUILD_COOLDOWN_MS,
  REPORT_REBUILD_LIMIT_PREFIX,
  REPORT_SECOND_MS,
  REPORT_TODAY_MAX_AGE_MS,
} from './constants/report.constants';
import { ReportAction } from './report.enums';
import { ReportView } from './report.view';

@Injectable()
@BotSection({
  access: BotAccess.EMPLOYEE,
  commands: [BotCommand.REPORT],
  namespace: BotNamespace.REPORT,
})
export class ReportHandler implements BotHandler {
  constructor(
    private readonly configService: ConfigService<AppEnvs, true>,
    private readonly redisService: RedisService,
    private readonly reportQueueProducer: ReportQueueProducer,
    private readonly reportView: ReportView,
  ) {}

  async handle({ actor, input, locale }: BotContext): Promise<BotReply> {
    if (!actor.user) {
      return { screen: { text: locale.bot.forbidden } };
    }
    if (input.type === ChatInputType.COMMAND) {
      return { screen: this.reportView.toMenu(locale), dialog: null };
    }
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }
    const button = REPORT_BUTTON_SCHEMA.safeParse(input.data.split(BOT_BUTTON_DATA_SEPARATOR));
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    const today = getToday(
      actor.user.timezone ?? this.configService.get('APP_TIMEZONE', { infer: true }),
    );
    switch (button.data.action) {
      case ReportAction.MENU:
        return { screen: this.reportView.toMenu(locale) };
      case ReportAction.DAYS:
        return { screen: this.reportView.toDays(locale, today) };
      case ReportAction.DAY: {
        const date = addDays(today, -button.data.offset);
        const dayText = this.reportView.toDayText(locale, date, today);
        await this.queue(
          actor,
          locale,
          date,
          dayText,
          button.data.offset === 0 ? REPORT_TODAY_MAX_AGE_MS : null,
        );
        return { screen: { text: locale.report.building(dayText) } };
      }
      case ReportAction.REBUILD:
        return this.rebuild(actor, locale, button.data.date, today);
    }
  }

  private async rebuild(
    actor: BotActor,
    locale: Locale,
    date: string,
    today: string,
  ): Promise<BotReply> {
    if (!actor.user || date > today || date < addDays(today, -REPORT_DAYS_BACK)) {
      return { screen: { text: locale.bot.expired }, newMessage: true };
    }
    const key = `${REPORT_REBUILD_LIMIT_PREFIX}${actor.user.id}`;
    if (!(await this.redisService.claim(key, REPORT_REBUILD_COOLDOWN_MS))) {
      const waitMs = await this.redisService.getTtlMs(key);
      return {
        screen: {
          text: locale.report.wait(Math.max(1, Math.ceil(waitMs / REPORT_SECOND_MS))),
        },
        newMessage: true,
      };
    }
    const dayText = this.reportView.toDayText(locale, date, today);
    await this.queue(actor, locale, date, dayText, 0);
    return { screen: { text: locale.report.rebuilding(dayText) }, newMessage: true };
  }

  private async queue(
    actor: BotActor,
    locale: Locale,
    date: string,
    dayText: string,
    maxAgeMs: number | null,
  ) {
    if (!actor.user) {
      return;
    }
    await this.reportQueueProducer.addReport({
      userId: actor.user.id,
      date,
      maxAgeMs,
      reply: { channel: actor.channel, chatId: actor.chatId, externalId: actor.externalId },
      notices: { empty: locale.report.empty(dayText), failed: locale.report.failed },
    });
  }
}
