import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { toLabelKey } from 'src/common/utils/label.util';
import { JobRole } from 'src/modules/application/user/user.enums';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { createTestApp } from 'test/setup/test-app';
import {
  LabelDimension,
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from '../label.enums';
import type { LabelMappingInsert, LabelValue } from '../label.interface';
import { LabelModule } from '../label.module';
import { labelMappings } from '../label.schema';
import { LabelService } from '../label.service';

function toMapping(
  label: string,
  dimension: LabelDimension,
  value: LabelValue,
  role: JobRole | null = null,
): LabelMappingInsert {
  return { label, labelKey: toLabelKey(label), role, dimension, value };
}

describe('Label module', () => {
  let app: NestFastifyApplication;
  let db: NodePgDatabase;
  let labelService: LabelService;

  beforeAll(async () => {
    app = await createTestApp([LabelModule]);
    db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
    labelService = app.get(LabelService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await db.delete(labelMappings);
  });

  it('stores a value for everyone and another for a role', async () => {
    await labelService.create(
      toMapping('type::e2e', LabelDimension.TASK_KIND, TaskKind.MAINTENANCE),
    );
    await labelService.create(
      toMapping(
        'Type::E2E',
        LabelDimension.TASK_KIND,
        TaskKind.TEST_AUTOMATION,
        JobRole.QA,
      ),
    );

    expect(
      await labelService.find(eq(labelMappings.labelKey, 'type::e2e')),
    ).toHaveLength(2);
  });

  it('keeps one row per label, dimension and role', async () => {
    await labelService.create(
      toMapping('type::e2e', LabelDimension.TASK_KIND, TaskKind.MAINTENANCE),
    );
    await labelService.create(
      toMapping(
        'type::e2e',
        LabelDimension.TASK_KIND,
        TaskKind.TEST_AUTOMATION,
        JobRole.QA,
      ),
    );

    await expect(
      labelService.create(
        toMapping('Type::E2E', LabelDimension.TASK_KIND, TaskKind.FEATURE),
      ),
    ).rejects.toMatchObject({
      cause: { constraint: 'label_mappings_label_key_dimension_role_unique' },
    });
    await expect(
      labelService.create(
        toMapping(
          'type::e2e',
          LabelDimension.TASK_KIND,
          TaskKind.FEATURE,
          JobRole.QA,
        ),
      ),
    ).rejects.toMatchObject({
      cause: { constraint: 'label_mappings_label_key_dimension_role_unique' },
    });
  });

  it('accepts only the values of the dimension', async () => {
    expect(
      await labelService.create(
        toMapping('severity::2', LabelDimension.SEVERITY, Severity.CRITICAL),
      ),
    ).toMatchObject({ value: Severity.CRITICAL });
    expect(
      await labelService.create(
        toMapping('frontend', LabelDimension.AREA, TaskArea.FRONTEND),
      ),
    ).toMatchObject({ value: TaskArea.FRONTEND });

    for (const [dimension, value] of [
      [LabelDimension.TASK_KIND, WorkflowState.REVIEW],
      [LabelDimension.SEVERITY, Priority.HIGH],
      [LabelDimension.AREA, TaskKind.BUG],
    ] as const) {
      await expect(
        labelService.create(toMapping('type::bug', dimension, value)),
      ).rejects.toMatchObject({
        cause: { constraint: 'label_mappings_dimension_value' },
      });
    }
  });

  it('lists every label once with its value for everyone first', async () => {
    await labelService.create(
      toMapping(
        'Status::Easy',
        LabelDimension.FLAG,
        TaskFlag.REGRESSION,
        JobRole.QA,
      ),
    );
    await labelService.create(
      toMapping('status::easy', LabelDimension.PRIORITY, Priority.LOW),
    );
    await labelService.create(
      toMapping('type::bug', LabelDimension.TASK_KIND, TaskKind.BUG),
    );

    expect(await labelService.countLabels()).toBe(2);
    expect(await labelService.findLabelPage(8, 0)).toMatchObject([
      { labelKey: 'status::easy', role: null, value: Priority.LOW },
      { labelKey: 'type::bug', value: TaskKind.BUG },
    ]);
    expect(await labelService.findLabelPage(1, 1)).toMatchObject([
      { labelKey: 'type::bug' },
    ]);
    expect(await labelService.findByKey('status::easy')).toHaveLength(2);
  });

  it('adds a value once and keeps the label as entered', async () => {
    const input = {
      label: ' Status::Easy ',
      role: null,
      dimension: LabelDimension.PRIORITY,
      value: Priority.LOW,
    };

    expect(await labelService.addValue(input)).toMatchObject({
      label: 'Status::Easy',
      labelKey: 'status::easy',
    });
    expect(await labelService.addValue(input)).toBeNull();
    expect(await labelService.findByKey('status::easy')).toHaveLength(1);
  });

  it('changes a value only to one of its group', async () => {
    const mapping = await labelService.create(
      toMapping('status::easy', LabelDimension.PRIORITY, Priority.LOW),
    );

    expect(
      await labelService.changeValue(mapping.id, Priority.HIGH),
    ).toMatchObject({ value: Priority.HIGH });
    await expect(
      labelService.changeValue(mapping.id, WorkflowState.REVIEW),
    ).rejects.toMatchObject({
      cause: { constraint: 'label_mappings_dimension_value' },
    });
  });

  it('deletes a value or the whole label', async () => {
    const first = await labelService.create(
      toMapping('status::easy', LabelDimension.PRIORITY, Priority.LOW),
    );
    await labelService.create(
      toMapping(
        'status::easy',
        LabelDimension.FLAG,
        TaskFlag.REGRESSION,
        JobRole.QA,
      ),
    );
    await labelService.create(
      toMapping('type::bug', LabelDimension.TASK_KIND, TaskKind.BUG),
    );

    expect(await labelService.deleteById(first.id)).toMatchObject({
      id: first.id,
    });
    expect(await labelService.findByKey('status::easy')).toHaveLength(1);
    expect(await labelService.deleteByKey('status::easy')).toHaveLength(1);
    expect(await labelService.findByKey('status::easy')).toEqual([]);
    expect(await labelService.findByKey('type::bug')).toHaveLength(1);
  });

  it('limits the label to 1-255 characters', async () => {
    for (const label of ['', 'a'.repeat(256)]) {
      await expect(
        labelService.create(
          toMapping(label, LabelDimension.TASK_KIND, TaskKind.BUG),
        ),
      ).rejects.toMatchObject({
        cause: { constraint: 'label_mappings_label_length' },
      });
    }
    expect(
      await labelService.create(
        toMapping('a'.repeat(255), LabelDimension.TASK_KIND, TaskKind.BUG),
      ),
    ).toMatchObject({ label: 'a'.repeat(255) });
  });
});
