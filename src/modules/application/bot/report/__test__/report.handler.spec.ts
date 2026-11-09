import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { User } from 'src/modules/application/user/user.interface';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import type { ReportQueueProducer } from 'src/modules/queue/report/report-queue.producer';
import type { BotActor } from '../../bot.interface';
import { ReportHandler } from '../report.handler';

const locale = new I18nService().getLocale(Language.RU);

function actor(user: Partial<User> | null): BotActor {
  return {
    channel: Channel.TELEGRAM,
    externalId: '1001',
    chatId: '2002',
    language: Language.RU,
    isOwner: false,
    user: user && ({ id: 'user-1', timezone: null, ...user } as User),
  };
}

describe('ReportHandler', () => {
  const producer = { addReport: vi.fn<ReportQueueProducer['addReport']>() };
  const config = { get: () => 'Europe/London' } as unknown as ConfigService<AppEnvs, true>;
  const handler = new ReportHandler(config, producer as unknown as ReportQueueProducer);

  afterEach(() => {
    vi.useRealTimers();
    producer.addReport.mockReset();
  });

  it('queues the report of today in the time zone of the employee and says so', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-09T20:30:00Z') });

    const reply = await handler.handle({
      actor: actor({ timezone: 'Asia/Almaty' }),
      locale,
      input: { type: ChatInputType.COMMAND, command: 'report' },
      dialog: null,
    });

    expect(reply).toEqual({ screen: { text: locale.report.building } });
    expect(producer.addReport).toHaveBeenCalledWith({
      userId: 'user-1',
      date: '2026-11-10',
      language: Language.RU,
      reply: { channel: Channel.TELEGRAM, chatId: '2002', externalId: '1001' },
    });
  });

  it('takes the default time zone when the employee has none', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-09T20:30:00Z') });

    await handler.handle({
      actor: actor({}),
      locale,
      input: { type: ChatInputType.COMMAND, command: 'report' },
      dialog: null,
    });

    expect(producer.addReport).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-11-09' }),
    );
  });
});
