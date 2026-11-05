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
