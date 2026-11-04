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
    it('creates, finds, updates and deletes a user', async () => {
      const gitlabUserId = nextId++;
      const created = await userService.create({
        gitlabUserId,
        gitlabUsername: `user${gitlabUserId}`,
        displayName: 'Petr',
        role: JobRole.DEVELOPER,
        gender: Gender.MALE,
      });

      expect(await userService.findOne(eq(users.id, created.id))).toEqual(
        created,
      );
      expect(
        await userService.find(eq(users.gitlabUserId, gitlabUserId)),
      ).toEqual([created]);
      expect(
        await userService.updateOne(eq(users.id, created.id), {
          role: JobRole.DEVOPS,
        }),
      ).toMatchObject({ id: created.id, role: JobRole.DEVOPS });
      expect(
        await userService.deleteOne(eq(users.id, created.id)),
      ).toMatchObject({ id: created.id });
      expect(await userService.findOne(eq(users.id, created.id))).toBeNull();
    });

    it('returns null when nothing matches an update or a delete', async () => {
      const user = await insertUser();
      await userService.deleteOne(eq(users.id, user.id));

      expect(
        await userService.updateOne(eq(users.id, user.id), {
          role: JobRole.DEVOPS,
        }),
      ).toBeNull();
      expect(await userService.deleteOne(eq(users.id, user.id))).toBeNull();
    });

    it('finds a user by id', async () => {
      const user = await insertUser();

      expect(await userService.findById(user.id)).toEqual(user);
      expect(
        await userService.findById('019a4d2e-7c1b-7f3a-9c2d-000000000000'),
      ).toBeNull();
    });

    it('finds a user by the GitLab id', async () => {
      const user = await insertUser();

      expect(await userService.findByGitlabId(user.gitlabUserId)).toEqual(user);
      expect(await userService.findByGitlabId(nextId++)).toBeNull();
    });

    it('counts users and pages them by name', async () => {
      const before = await userService.count();
      await insertUser();
      await insertUser();

      expect(await userService.count()).toBe(before + 2);
      expect(await userService.findPage(1, 0)).toHaveLength(1);
      expect(await userService.findPage(10, before + 1)).toHaveLength(1);
    });

    it('searches by name and username without case and in name order', async () => {
      const tag = `Tag${nextId}`;
      const second = await insertUser({ displayName: `${tag} Boris` });
      const first = await insertUser({ displayName: `${tag} Anna` });
      const byUsername = await insertUser({
        displayName: 'Viktor',
        gitlabUsername: `${tag.toLowerCase()}_viktor`,
      });

      expect(
        (await userService.search(tag.toUpperCase(), 10)).map(
          (user) => user.id,
        ),
      ).toEqual([first.id, second.id, byUsername.id]);
      expect(await userService.search(tag, 2)).toHaveLength(2);
    });

    it('treats % and _ in a query as plain characters', async () => {
      const tag = `Lit${nextId}`;
      const underscore = await insertUser({ displayName: `${tag} a_b` });
      await insertUser({ displayName: `${tag} axb` });
      const percent = await insertUser({ displayName: `${tag} 50%` });
      await insertUser({ displayName: `${tag} 500` });

      expect(
        (await userService.search(`${tag} a_b`, 10)).map((user) => user.id),
      ).toEqual([underscore.id]);
      expect(
        (await userService.search(`${tag} 50%`, 10)).map((user) => user.id),
      ).toEqual([percent.id]);
    });

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

  describe('employee management', () => {
    it('changes the role', async () => {
      const user = await insertUser({ role: JobRole.QA });

      await userService.changeRole(user.id, JobRole.DEVOPS);

      expect((await findUser(user.id)).role).toBe(JobRole.DEVOPS);
    });

    it('blocks and unblocks a user with a channel as active', async () => {
      const user = await insertUser({ status: UserStatus.ACTIVE });
      await insertChannel(user.id);

      await userService.block(user.id);
      expect((await findUser(user.id)).status).toBe(UserStatus.BLOCKED);

      await userService.unblock(user.id);
      expect((await findUser(user.id)).status).toBe(UserStatus.ACTIVE);
    });

    it('unblocks a user without channels as pending', async () => {
      const user = await insertUser({ status: UserStatus.BLOCKED });

      await userService.unblock(user.id);

      expect((await findUser(user.id)).status).toBe(UserStatus.PENDING);
    });

    it('does not unblock a user who is not blocked', async () => {
      const user = await insertUser({ status: UserStatus.ON_LEAVE });

      expect(await userService.unblock(user.id)).toBeNull();
      expect((await findUser(user.id)).status).toBe(UserStatus.ON_LEAVE);
    });

    it('deletes a user with the channels', async () => {
      const user = await insertUser();
      await insertChannel(user.id);

      expect(await userService.deleteById(user.id)).toMatchObject({
        id: user.id,
      });
      expect(await userService.findById(user.id)).toBeNull();
      expect(await channelService.findByUser(user.id)).toEqual([]);
    });
  });

  describe('channel binding', () => {
    it('binds a channel and activates a pending user', async () => {
      const user = await insertUser({ status: UserStatus.PENDING });
      const externalId = String(nextId++);

      const channel = await userService.bindChannel(
        user.id,
        Channel.TELEGRAM,
        externalId,
      );

      expect(channel).toMatchObject({
        userId: user.id,
        channel: Channel.TELEGRAM,
        externalId,
        reachable: true,
      });
      expect((await findUser(user.id)).status).toBe(UserStatus.ACTIVE);
    });

    it.each([UserStatus.ON_LEAVE, UserStatus.BLOCKED])(
      'keeps the %s status',
      async (status) => {
        const user = await insertUser({ status });

        await userService.bindChannel(
          user.id,
          Channel.TELEGRAM,
          String(nextId++),
        );

        expect((await findUser(user.id)).status).toBe(status);
      },
    );

    it('changes nothing when the account is already bound', async () => {
      const owner = await insertUser({ status: UserStatus.ACTIVE });
      const taken = await insertChannel(owner.id);
      const user = await insertUser({ status: UserStatus.PENDING });

      await expect(
        userService.bindChannel(user.id, Channel.TELEGRAM, taken.externalId),
      ).rejects.toThrow();

      expect((await findUser(user.id)).status).toBe(UserStatus.PENDING);
      expect(await channelService.findByUser(user.id)).toEqual([]);
    });
  });

  describe('ChannelService', () => {
    it('creates, finds, updates and deletes a channel', async () => {
      const user = await insertUser();
      const created = await channelService.create({
        userId: user.id,
        channel: Channel.TELEGRAM,
        externalId: String(nextId++),
      });

      expect(created.reachable).toBe(true);
      expect(
        await channelService.findOne(eq(userChannels.id, created.id)),
      ).toEqual(created);
      expect(
        await channelService.find(eq(userChannels.userId, user.id)),
      ).toEqual([created]);
      expect(
        await channelService.updateOne(eq(userChannels.id, created.id), {
          reachable: false,
        }),
      ).toMatchObject({ id: created.id, reachable: false });
      expect(
        await channelService.deleteOne(eq(userChannels.id, created.id)),
      ).toMatchObject({ id: created.id });
      expect(
        await channelService.find(eq(userChannels.userId, user.id)),
      ).toEqual([]);
    });

    it('finds the channels of a user', async () => {
      const user = await insertUser();
      const channel = await insertChannel(user.id);

      expect(await channelService.findByUser(user.id)).toEqual([channel]);
    });

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
