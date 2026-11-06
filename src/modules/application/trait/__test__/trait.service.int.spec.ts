import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { toSourceKey } from 'src/common/utils/source-name.util';
import { JobRole } from 'src/modules/application/user/user.enums';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { Source } from 'src/modules/application/source/source.enums';
import { createTestApp } from 'test/setup/test-app';
import {
  TraitDimension,
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from '../trait.enums';
import type { TraitMappingInsert, TraitValue } from '../trait.interface';
import { TraitModule } from '../trait.module';
import { traitMappings } from '../trait.schema';
import { TraitService } from '../trait.service';

function toMapping(
  label: string,
  dimension: TraitDimension,
  value: TraitValue,
  role: JobRole | null = null,
): TraitMappingInsert {
  return {
    source: Source.GITLAB,
    sourceName: label,
    sourceKey: toSourceKey(label),
    role,
    dimension,
    value,
  };
}

describe('Trait module', () => {
  let app: NestFastifyApplication;
  let db: NodePgDatabase;
  let traitService: TraitService;

  beforeAll(async () => {
    app = await createTestApp([TraitModule]);
    db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
    traitService = app.get(TraitService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await db.delete(traitMappings);
  });

  it('stores a value for everyone and another for a role', async () => {
    await traitService.create(
      toMapping('type::e2e', TraitDimension.TASK_KIND, TaskKind.MAINTENANCE),
    );
    await traitService.create(
      toMapping('Type::E2E', TraitDimension.TASK_KIND, TaskKind.TEST_AUTOMATION, JobRole.QA),
    );

    expect(await traitService.find(eq(traitMappings.sourceKey, 'type::e2e'))).toHaveLength(2);
  });

  it('keeps one row per label, dimension and role', async () => {
    await traitService.create(
      toMapping('type::e2e', TraitDimension.TASK_KIND, TaskKind.MAINTENANCE),
    );
    await traitService.create(
      toMapping('type::e2e', TraitDimension.TASK_KIND, TaskKind.TEST_AUTOMATION, JobRole.QA),
    );

    await expect(
      traitService.create(toMapping('Type::E2E', TraitDimension.TASK_KIND, TaskKind.FEATURE)),
    ).rejects.toMatchObject({
      cause: {
        constraint: 'trait_mappings_source_source_key_dimension_role_unique',
      },
    });
    await expect(
      traitService.create(
        toMapping('type::e2e', TraitDimension.TASK_KIND, TaskKind.FEATURE, JobRole.QA),
      ),
    ).rejects.toMatchObject({
      cause: {
        constraint: 'trait_mappings_source_source_key_dimension_role_unique',
      },
    });
  });

  it('accepts only the values of the dimension', async () => {
    expect(
      await traitService.create(
        toMapping('severity::2', TraitDimension.SEVERITY, Severity.CRITICAL),
      ),
    ).toMatchObject({ value: Severity.CRITICAL });
    expect(
      await traitService.create(toMapping('frontend', TraitDimension.AREA, TaskArea.FRONTEND)),
    ).toMatchObject({ value: TaskArea.FRONTEND });

    for (const [dimension, value] of [
      [TraitDimension.TASK_KIND, WorkflowState.REVIEW],
      [TraitDimension.SEVERITY, Priority.HIGH],
      [TraitDimension.AREA, TaskKind.BUG],
    ] as const) {
      await expect(
        traitService.create(toMapping('type::bug', dimension, value)),
      ).rejects.toMatchObject({
        cause: { constraint: 'trait_mappings_dimension_value' },
      });
    }
  });

  it('lists every label once with its value for everyone first', async () => {
    await traitService.create(
      toMapping('Status::Easy', TraitDimension.FLAG, TaskFlag.REGRESSION, JobRole.QA),
    );
    await traitService.create(toMapping('status::easy', TraitDimension.PRIORITY, Priority.LOW));
    await traitService.create(toMapping('type::bug', TraitDimension.TASK_KIND, TaskKind.BUG));

    expect(await traitService.countSourceNames()).toBe(2);
    expect(await traitService.findSourceNamePage(8, 0)).toMatchObject([
      { sourceKey: 'status::easy', role: null, value: Priority.LOW },
      { sourceKey: 'type::bug', value: TaskKind.BUG },
    ]);
    expect(await traitService.findSourceNamePage(1, 1)).toMatchObject([{ sourceKey: 'type::bug' }]);
    expect(await traitService.findByKey(Source.GITLAB, 'status::easy')).toHaveLength(2);
  });

  it('adds a value once and keeps the label as entered', async () => {
    const input = {
      source: Source.GITLAB,
      sourceName: ' Status::Easy ',
      role: null,
      dimension: TraitDimension.PRIORITY,
      value: Priority.LOW,
    };

    expect(await traitService.addValue(input)).toMatchObject({
      source: Source.GITLAB,
      sourceName: 'Status::Easy',
      sourceKey: 'status::easy',
    });
    expect(await traitService.addValue(input)).toBeNull();
    expect(await traitService.findByKey(Source.GITLAB, 'status::easy')).toHaveLength(1);
  });

  it('changes a value only to one of its group', async () => {
    const mapping = await traitService.create(
      toMapping('status::easy', TraitDimension.PRIORITY, Priority.LOW),
    );

    expect(await traitService.changeValue(mapping.id, Priority.HIGH)).toMatchObject({
      value: Priority.HIGH,
    });
    await expect(traitService.changeValue(mapping.id, WorkflowState.REVIEW)).rejects.toMatchObject({
      cause: { constraint: 'trait_mappings_dimension_value' },
    });
  });

  it('deletes a value or the whole label', async () => {
    const first = await traitService.create(
      toMapping('status::easy', TraitDimension.PRIORITY, Priority.LOW),
    );
    await traitService.create(
      toMapping('status::easy', TraitDimension.FLAG, TaskFlag.REGRESSION, JobRole.QA),
    );
    await traitService.create(toMapping('type::bug', TraitDimension.TASK_KIND, TaskKind.BUG));

    expect(await traitService.deleteById(first.id)).toMatchObject({
      id: first.id,
    });
    expect(await traitService.findByKey(Source.GITLAB, 'status::easy')).toHaveLength(1);
    expect(await traitService.deleteByKey(Source.GITLAB, 'status::easy')).toHaveLength(1);
    expect(await traitService.findByKey(Source.GITLAB, 'status::easy')).toEqual([]);
    expect(await traitService.findByKey(Source.GITLAB, 'type::bug')).toHaveLength(1);
  });

  it('limits the label to 1-255 characters', async () => {
    for (const label of ['', 'a'.repeat(256)]) {
      await expect(
        traitService.create(toMapping(label, TraitDimension.TASK_KIND, TaskKind.BUG)),
      ).rejects.toMatchObject({
        cause: { constraint: 'trait_mappings_source_name_length' },
      });
    }
    expect(
      await traitService.create(toMapping('a'.repeat(255), TraitDimension.TASK_KIND, TaskKind.BUG)),
    ).toMatchObject({ sourceName: 'a'.repeat(255) });
  });
});
