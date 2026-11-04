import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Channel } from 'src/common/enums/channel.enums';
import {
  Gender,
  JobRole,
  UserStatus,
} from 'src/modules/application/user/user.enums';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { createTestApp } from 'test/setup/test-app';
import type { UserChannelInsert } from '../channel/channel.interface';
import { userChannels } from '../channel/channel.schema';
import { ChannelService } from '../channel/channel.service';
import type { UserInsert } from '../user.interface';
import { users } from '../user.schema';
import { UserService } from '../user.service';

let nextId = 400_000_000;

describe('User module', () => {
  let app: NestFastifyApplication;
  let db: NodePgDatabase;
  let userService: UserService;
  let channelService: ChannelService;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
    userService = app.get(UserService);
    channelService = app.get(ChannelService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function insertUser(values: Partial<UserInsert> = {}) {
    const gitlabUserId = nextId++;
    const [user] = await db
      .insert(users)
      .values({
        gitlabUserId,
        gitlabUsername: `user${gitlabUserId}`,
        displayName: 'Anna_Smirnova',
        role: JobRole.QA,
        gender: Gender.FEMALE,
        ...values,
      })
      .returning();
    return user;
  }

  async function insertChannel(
    userId: string,
    values: Partial<UserChannelInsert> = {},
  ) {
    const [channel] = await db
      .insert(userChannels)
      .values({
        userId,
        channel: Channel.TELEGRAM,
        externalId: String(nextId++),
        ...values,
      })
      .returning();
    return channel;
  }

  async function findUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async function findChannel(id: string) {
    const [channel] = await db
      .select()
      .from(userChannels)
      .where(eq(userChannels.id, id));
    return channel;
  }

  describe('UserService', () => {
    it('finds a user with the channel by a telegram id', async () => {
      const user = await insertUser();
      const channel = await insertChannel(user.id);

      expect(
        await userService.findOneByChannel(
          Channel.TELEGRAM,
          channel.externalId,
        ),
      ).toEqual({ user, channel });
    });

    it('returns null for an unknown telegram id', async () => {
      expect(
        await userService.findOneByChannel(Channel.TELEGRAM, String(nextId++)),
      ).toBeNull();
    });

    it('matches the id only within its channel', async () => {
      const user = await insertUser();
      const channel = await insertChannel(user.id, { channel: Channel.SLACK });

      expect(
        await userService.findOneByChannel(
          Channel.TELEGRAM,
          channel.externalId,
        ),
      ).toBeNull();
      expect(
        await userService.findOneByChannel(Channel.SLACK, channel.externalId),
      ).toEqual({ user, channel });
    });

    it('records the language of a user without one', async () => {
      const user = await insertUser();
      const channel = await insertChannel(user.id);

      await userService.recordContact({ user, channel }, Language.RU);

      expect((await findUser(user.id)).language).toBe(Language.RU);
    });

    it('keeps the language a user already has', async () => {
      const user = await insertUser({ language: Language.EN });
      const channel = await insertChannel(user.id);

      await userService.recordContact({ user, channel }, Language.RU);

      expect((await findUser(user.id)).language).toBe(Language.EN);
    });

    it('keeps a language stored after the user was loaded', async () => {
      const user = await insertUser({ language: Language.EN });
      const channel = await insertChannel(user.id);

      await userService.recordContact(
        { user: { ...user, language: null }, channel },
        Language.RU,
      );

      expect((await findUser(user.id)).language).toBe(Language.EN);
    });

    it('marks an unreachable channel reachable', async () => {
      const user = await insertUser({ language: Language.EN });
      const channel = await insertChannel(user.id, { reachable: false });

      await userService.recordContact({ user, channel }, Language.EN);

      expect((await findChannel(channel.id)).reachable).toBe(true);
    });
  });

  describe('ChannelService', () => {
    it('flips the reachable flag and returns the channel', async () => {
      const user = await insertUser();
      const channel = await insertChannel(user.id);

      const updated = await channelService.updateReachable(
        Channel.TELEGRAM,
        channel.externalId,
        false,
      );

      expect(updated).toMatchObject({ id: channel.id, reachable: false });
      expect((await findChannel(channel.id)).reachable).toBe(false);
    });

    it('returns null when the flag already has the value', async () => {
      const user = await insertUser();
      const channel = await insertChannel(user.id, { reachable: false });

      expect(
        await channelService.updateReachable(
          Channel.TELEGRAM,
          channel.externalId,
          false,
        ),
      ).toBeNull();
      expect((await findChannel(channel.id)).reachable).toBe(false);
    });

    it('returns null for an unknown channel', async () => {
      expect(
        await channelService.updateReachable(
          Channel.TELEGRAM,
          String(nextId++),
          false,
        ),
      ).toBeNull();
    });

    it('changes only the channel of the given type', async () => {
      const telegramUser = await insertUser();
      const slackUser = await insertUser();
      const telegram = await insertChannel(telegramUser.id);
      const slack = await insertChannel(slackUser.id, {
        channel: Channel.SLACK,
        externalId: telegram.externalId,
      });

      await channelService.updateReachable(
        Channel.TELEGRAM,
        telegram.externalId,
        false,
      );

      expect((await findChannel(telegram.id)).reachable).toBe(false);
      expect((await findChannel(slack.id)).reachable).toBe(true);
    });
  });

  describe('tables', () => {
    it('fills the defaults of a new user', async () => {
      expect(await insertUser()).toMatchObject({
        status: UserStatus.PENDING,
        language: null,
        timezone: null,
        onLeaveUntil: null,
        reportTime: '18:00:00',
        aiEnabled: true,
        aiDataOptOut: false,
        notifyEmpty: true,
        preset: null,
        permissions: [],
      });
    });

    it('accepts report times in 15 minute steps only', async () => {
      await expect(insertUser({ reportTime: '18:10' })).rejects.toMatchObject({
        cause: { constraint: 'users_report_time_step' },
      });
      expect(await insertUser({ reportTime: '18:15' })).toMatchObject({
        reportTime: '18:15:00',
      });
    });

    it('limits the display name to 1-255 characters', async () => {
      await expect(insertUser({ displayName: '' })).rejects.toMatchObject({
        cause: { constraint: 'users_display_name_length' },
      });
      await expect(
        insertUser({ displayName: 'a'.repeat(256) }),
      ).rejects.toMatchObject({
        cause: { constraint: 'users_display_name_length' },
      });
      expect(await insertUser({ displayName: 'a'.repeat(255) })).toMatchObject({
        displayName: 'a'.repeat(255),
      });
    });

    it('rejects a second user with the same gitlab id', async () => {
      const user = await insertUser();

      await expect(
        insertUser({ gitlabUserId: user.gitlabUserId }),
      ).rejects.toMatchObject({
        cause: { constraint: 'users_gitlab_user_id_unique' },
      });
    });

    it('links an external id to one user per channel', async () => {
      const first = await insertUser();
      const second = await insertUser();
      const channel = await insertChannel(first.id);

      await expect(
        insertChannel(second.id, { externalId: channel.externalId }),
      ).rejects.toMatchObject({
        cause: { constraint: 'user_channels_channel_external_id_unique' },
      });
      expect(
        await insertChannel(second.id, {
          channel: Channel.SLACK,
          externalId: channel.externalId,
        }),
      ).toMatchObject({ userId: second.id, channel: Channel.SLACK });
    });

    it('gives a user one account per channel', async () => {
      const user = await insertUser();
      await insertChannel(user.id);

      await expect(insertChannel(user.id)).rejects.toMatchObject({
        cause: { constraint: 'user_channels_user_id_channel_unique' },
      });
      expect(
        await insertChannel(user.id, { channel: Channel.SLACK }),
      ).toMatchObject({ userId: user.id, channel: Channel.SLACK });
    });

    it('rejects an empty external id', async () => {
      const user = await insertUser();

      await expect(
        insertChannel(user.id, { externalId: '' }),
      ).rejects.toMatchObject({
        cause: { constraint: 'user_channels_external_id_length' },
      });
    });

    it('deletes the channels of a deleted user', async () => {
      const user = await insertUser();
      await insertChannel(user.id);
      await insertChannel(user.id, { channel: Channel.SLACK });

      await db.delete(users).where(eq(users.id, user.id));

      expect(
        await db
          .select()
          .from(userChannels)
          .where(eq(userChannels.userId, user.id)),
      ).toEqual([]);
    });
  });
});
