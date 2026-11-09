import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Source } from 'src/modules/application/source/source.enums';
import { JobRole } from 'src/modules/application/user/user.enums';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { createTestApp } from 'test/setup/test-app';
import { TRAIT_DAY_MS } from '../../constants/trait.constants';
import { Priority, TraitDimension } from '../../trait.enums';
import { TraitModule } from '../../trait.module';
import { traitMappings } from '../../trait.schema';
import { TraitService } from '../../trait.service';
import { traitNames } from '../trait-name.schema';
import { TraitNameService } from '../trait-name.service';

describe('TraitNameService', () => {
  let app: NestFastifyApplication;
  let db: NodePgDatabase;
  let traitNameService: TraitNameService;
  let traitService: TraitService;

  beforeAll(async () => {
    app = await createTestApp([TraitModule]);
    db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
    traitNameService = app.get(TraitNameService);
    traitService = app.get(TraitService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await db.delete(traitNames);
    await db.delete(traitMappings);
  });

  async function findKeys(ignored: boolean) {
    const names = await traitNameService.findUnmappedPage(Source.GITLAB, ignored, 10, 0);
    return names.map((name) => name.sourceKey);
  }

  it('records a name once in its first spelling and skips what is not a name', async () => {
    await traitNameService.record(Source.GITLAB, ['Team::Web', ' team::web ', '::web', '']);
    const [first] = await traitNameService.find();
    await db
      .update(traitNames)
      .set({ seenAt: new Date(Date.now() - 40 * TRAIT_DAY_MS) })
      .where(eq(traitNames.id, first.id));

    await traitNameService.record(Source.GITLAB, ['TEAM::WEB', 'x'.repeat(256)]);

    const names = await traitNameService.find();
    expect(names.map(({ sourceName, sourceKey }) => [sourceName, sourceKey])).toEqual([
      ['Team::Web', 'team::web'],
    ]);
    expect(Date.now() - names[0].seenAt.getTime()).toBeLessThan(TRAIT_DAY_MS);
  });

  it('lists the names of the last 30 days that have no mapping for anyone', async () => {
    await traitNameService.record(Source.GITLAB, ['team::web', 'bug', 'priority::low', 'old']);
    await db
      .update(traitNames)
      .set({ seenAt: new Date(Date.now() - 31 * TRAIT_DAY_MS) })
      .where(eq(traitNames.sourceKey, 'old'));
    await traitService.addValue({
      source: Source.GITLAB,
      sourceName: 'Priority::Low',
      role: JobRole.QA,
      dimension: TraitDimension.PRIORITY,
      value: Priority.LOW,
    });

    expect(await traitNameService.countUnmapped(Source.GITLAB, false)).toBe(2);
    expect(await findKeys(false)).toEqual(['bug', 'team::web']);
    expect(
      (await traitNameService.findUnmappedPage(Source.GITLAB, false, 1, 1)).map(
        (name) => name.sourceKey,
      ),
    ).toEqual(['team::web']);
  });

  it('moves an ignored name to its own list, however old, and back', async () => {
    await traitNameService.record(Source.GITLAB, ['team::web', 'bug']);
    const [web] = await traitNameService.find(eq(traitNames.sourceKey, 'team::web'));

    expect(await traitNameService.setIgnored(web.id, true)).toMatchObject({ ignored: true });
    await db
      .update(traitNames)
      .set({ seenAt: new Date(Date.now() - 90 * TRAIT_DAY_MS) })
      .where(eq(traitNames.id, web.id));

    expect(await findKeys(false)).toEqual(['bug']);
    expect(await findKeys(true)).toEqual(['team::web']);
    expect(await traitNameService.countUnmapped(Source.GITLAB, true)).toBe(1);

    await traitNameService.setIgnored(web.id, false);
    expect(await findKeys(true)).toEqual([]);
  });

  it('puts the ignored names without a mapping into the index', async () => {
    await traitNameService.record(Source.GITLAB, ['Team::Web', 'bug']);
    for (const name of await traitNameService.find()) {
      await traitNameService.setIgnored(name.id, true);
    }
    await traitService.addValue({
      source: Source.GITLAB,
      sourceName: 'bug',
      role: null,
      dimension: TraitDimension.PRIORITY,
      value: Priority.LOW,
    });

    const index = await traitService.loadIndex(Source.GITLAB, JobRole.DEVELOPER);

    expect([...index.ignored]).toEqual(['team::web']);
    expect(traitService.isIgnored(index, ' TEAM::Web ')).toBe(true);
    expect(traitService.isIgnored(index, 'bug')).toBe(false);
  });
});
