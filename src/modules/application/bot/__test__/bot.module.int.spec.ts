import { Injectable, Module } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BotCommand } from 'src/modules/application/bot/core/types/bot.enums';
import { findBotHandlersWithoutAccess } from 'test/setup/access';
import { createTestApp } from 'test/setup/test-app';
import { BotSection } from '../core/bot.decorator';
import { BotAccess } from '../core/types/bot.enums';
import { RouterService } from '../core/router.service';

@Injectable()
@BotSection()
class OrphanHandler {}

@Injectable()
class PlainHandler {}

@Injectable()
@BotSection({ access: 'nobody' as BotAccess })
class InvalidHandler {}

@Module({ providers: [OrphanHandler, PlainHandler, InvalidHandler] })
class ExtraModule {}

describe('BotModule', () => {
  describe('in the app', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('declares access on every handler', () => {
      expect(findBotHandlersWithoutAccess(app)).toEqual([]);
    });
  });

  describe('with handlers without access', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      app = await createTestApp([ExtraModule]);
    });

    afterAll(async () => {
      await app.close();
    });

    it('reports every handler without a valid access', () => {
      expect(findBotHandlersWithoutAccess(app).toSorted()).toEqual([
        'InvalidHandler',
        'OrphanHandler',
        'PlainHandler',
      ]);
    });

    it('starts and keeps the commands of the real handlers', () => {
      expect(app.get(RouterService).listMenu()).toEqual([
        { command: BotCommand.START, access: BotAccess.ANYONE },
        { command: BotCommand.REPORT, access: BotAccess.EMPLOYEE },
        { command: BotCommand.SETTINGS, access: BotAccess.EMPLOYEE },
        { command: BotCommand.ADMIN, access: BotAccess.ADMIN },
        { command: BotCommand.HELP, access: BotAccess.ANYONE },
        { command: BotCommand.CANCEL, access: BotAccess.ANYONE },
      ]);
    });
  });
});
