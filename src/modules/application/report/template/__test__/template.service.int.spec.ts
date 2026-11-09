import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Gender, JobRole } from 'src/modules/application/user/user.enums';
import { users } from 'src/modules/application/user/user.schema';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { createTestApp } from 'test/setup/test-app';
import { reportTemplates } from '../template.schema';
import { TemplateService } from '../template.service';

describe('TemplateService', () => {
  let app: NestFastifyApplication;
  let db: NodePgDatabase;
  let templateService: TemplateService;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
    templateService = app.get(TemplateService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await db.delete(reportTemplates);
    await db.delete(users);
  });

  async function insertUser(displayName: string) {
    const [user] = await db
      .insert(users)
      .values({ displayName, role: JobRole.QA, gender: Gender.FEMALE })
      .returning();
    return user;
  }

  it('offers the shared templates first and only the own personal ones', async () => {
    const anna = await insertUser('Anna');
    const olga = await insertUser('Olga');
    await templateService.create({ name: 'Zeta', body: '1', ownerId: anna.id });
    await templateService.create({ name: 'QA', body: '2', ownerId: null });
    await templateService.create({ name: 'Alpha', body: '3', ownerId: anna.id });
    await templateService.create({ name: 'Olga only', body: '4', ownerId: olga.id });

    expect((await templateService.findAvailable(anna.id)).map(({ name }) => name)).toEqual([
      'QA',
      'Alpha',
      'Zeta',
    ]);
    expect((await templateService.findOwn(olga.id)).map(({ name }) => name)).toEqual(['Olga only']);
  });

  it('deletes only an own template and returns the employee to Standard', async () => {
    const anna = await insertUser('Anna');
    const olga = await insertUser('Olga');
    const template = await templateService.create({ name: 'Mine', body: '1', ownerId: anna.id });
    await db.update(users).set({ templateId: template.id }).where(eq(users.id, anna.id));

    expect(await templateService.deleteOwn(template.id, olga.id)).toBeNull();
    expect(await templateService.deleteOwn(template.id, anna.id)).toMatchObject({
      id: template.id,
    });

    const [stored] = await db.select().from(users).where(eq(users.id, anna.id));
    expect(stored.templateId).toBeNull();
  });

  it('refuses an empty name and a text over the limit', async () => {
    await expect(templateService.create({ name: '', body: '1', ownerId: null })).rejects.toThrow();
    await expect(
      templateService.create({ name: 'Long', body: 'x'.repeat(4001), ownerId: null }),
    ).rejects.toThrow();
  });
});
