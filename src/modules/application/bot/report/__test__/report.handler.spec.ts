import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { User } from 'src/modules/application/user/types/user.interface';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import type { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import type { ReportQueueProducer } from 'src/modules/queue/report/report-queue.producer';
import type { BotActor } from '../../core/types/bot.interface';
import { ReportHandler } from '../report.handler';
import { ReportView } from '../report.view';

const locale = new I18nService().getLocale(Language.RU);

const REPLY = { channel: Channel.TELEGRAM, chatId: '2002', externalId: '1001' };

function actor(timezone: string | null = 'Asia/Almaty'): BotActor {
  return {
    channel: Channel.TELEGRAM,
    externalId: '1001',
    chatId: '2002',
    language: Language.RU,
    isOwner: false,
    user: { id: 'user-1', timezone } as User,
  };
}

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('ReportHandler', () => {
  const producer = { addReport: vi.fn<ReportQueueProducer['addReport']>() };
  const redis = {
    claim: vi.fn<RedisService['claim']>(),
    getTtlMs: vi.fn<RedisService['getTtlMs']>(),
  };
  const config = { get: () => 'Europe/London' } as unknown as ConfigService<AppEnvs, true>;
  const handler = new ReportHandler(
    config,
    redis as unknown as RedisService,
    producer as unknown as ReportQueueProducer,
    new ReportView(),
  );
  const open = (input: ChatInput, who = actor()) =>
    handler.handle({ actor: who, locale, input, dialog: null });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: Date.parse('2026-11-09T20:30:00Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers today, yesterday and another day', async () => {
    expect(await open({ type: ChatInputType.COMMAND, command: 'report' })).toEqual({
      screen: {
        text: locale.report.choose,
        buttons: [
          [
            { text: 'Сегодня', data: 'rpt:day:0' },
            { text: 'Вчера', data: 'rpt:day:1' },
          ],
          [{ text: 'Другой день', data: 'rpt:days' }],
        ],
      },
      dialog: null,
    });
  });

  it('lists the days before yesterday up to 14 days back, three in a row', async () => {
    const { screen } = await open(button('rpt:days'));

    expect(screen.text).toBe(locale.report.chooseDay(14));
    expect(screen.buttons?.map((row) => row.length)).toEqual([3, 3, 3, 3, 1, 1]);
    expect(screen.buttons?.[0]).toEqual([
      { text: 'вс, 8 нояб.', data: 'rpt:day:2' },
      { text: 'сб, 7 нояб.', data: 'rpt:day:3' },
      { text: 'пт, 6 нояб.', data: 'rpt:day:4' },
    ]);
    expect(screen.buttons?.at(-1)).toEqual([{ text: 'Назад', data: 'rpt:menu' }]);
  });

  it('builds today in the time zone of the employee, reusing a report of the last 5 minutes', async () => {
    expect(await open(button('rpt:day:0'))).toEqual({
      screen: { text: locale.report.building('сегодня') },
    });
    expect(producer.addReport).toHaveBeenCalledWith({
      userId: 'user-1',
      date: '2026-11-10',
      maxAgeMs: 300_000,
      own: true,
      channel: REPLY.channel,
      notice: {
        target: REPLY,
        empty: locale.report.empty('сегодня'),
        failed: locale.report.failed,
      },
    });
  });

  it('reuses any saved report of a past day', async () => {
    await open(button('rpt:day:1'));
    await open(button('rpt:day:6'), actor(null));

    expect(
      producer.addReport.mock.calls.map(([data]) => [data.date, data.notice?.empty, data.maxAgeMs]),
    ).toEqual([
      ['2026-11-09', locale.report.empty('вчера'), null],
      ['2026-11-03', locale.report.empty('3 ноября'), null],
    ]);
  });

  it('rebuilds a day in a new message once a minute', async () => {
    redis.claim.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    redis.getTtlMs.mockResolvedValue(41_200);

    expect(await open(button('rpt:rebuild:2026-11-03'))).toEqual({
      screen: { text: locale.report.rebuilding('3 ноября') },
      newMessage: true,
    });
    expect(redis.claim).toHaveBeenCalledWith('limit:report-rebuild:user-1', 60_000);
    expect(producer.addReport).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-11-03', maxAgeMs: 0 }),
    );

    expect(await open(button('rpt:rebuild:2026-11-03'))).toEqual({
      screen: { text: locale.report.wait(42) },
      newMessage: true,
    });
    expect(producer.addReport).toHaveBeenCalledOnce();
  });

  it('refuses to rebuild a day older than 14 days and broken buttons', async () => {
    expect(await open(button('rpt:rebuild:2026-10-20'))).toEqual({
      screen: { text: locale.bot.expired },
      newMessage: true,
    });
    expect(await open(button('rpt:day:15'))).toEqual({ screen: { text: locale.bot.expired } });
    expect(producer.addReport).not.toHaveBeenCalled();
    expect(redis.claim).not.toHaveBeenCalled();
  });
});
