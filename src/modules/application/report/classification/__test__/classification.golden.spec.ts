import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { Source } from 'src/modules/application/source/source.enums';
import type { GroupedDailyData } from 'src/modules/application/source/source.interface';
import { TaskKind } from 'src/modules/application/trait/trait.enums';
import type { TraitRepository } from 'src/modules/application/trait/trait.repository';
import { TraitService } from 'src/modules/application/trait/trait.service';
import type { JobRole } from 'src/modules/application/user/user.enums';
import { ActivityAction } from '../classification.enums';
import type { ClassifiedDay } from '../classification.interface';
import { ClassificationService } from '../classification.service';
import { createBuilder, createResolver, createV1TraitIndex } from './classification.fixture';

const DIRECTORY = join(process.cwd(), 'test', 'fixtures', 'golden');

const V1_ACTIONS: Record<string, ActivityAction> = {
  ...Object.fromEntries(Object.entries(ActivityAction)),
  PASSED_TO_FRONTEND: ActivityAction.HANDED_OFF,
};

const V1_KINDS: Record<string, TaskKind | null> = {
  BUG: TaskKind.BUG,
  FEATURE: TaskKind.FEATURE,
  HOTFIX: TaskKind.HOTFIX,
  CHORE: TaskKind.MAINTENANCE,
  EPIC: TaskKind.EPIC,
  QA_INTERNAL: TaskKind.QA_INTERNAL,
  UNKNOWN: null,
};

interface GoldenFixture {
  role: JobRole;
  username: string;
  date: string;
  day: GroupedDailyData;
}

interface GoldenVerdict {
  projectId: number;
  iid?: number;
  branch?: string;
  status: string;
  taskType: string;
}

interface GoldenVerdicts {
  issues: GoldenVerdict[];
  standaloneMergeRequests: GoldenVerdict[];
  standalonePushes: GoldenVerdict[];
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(DIRECTORY, name), 'utf8')) as T;
}

function toLines(day: ClassifiedDay) {
  return [
    ...day.issues.map(
      ({ projectId, iid, classification }) =>
        `${projectId}#${iid} ${classification.action} ${classification.kind}`,
    ),
    ...day.standaloneMergeRequests.map(
      ({ projectId, iid, classification }) =>
        `${projectId}!${iid} ${classification.action} ${classification.kind}`,
    ),
    ...day.standalonePushes.map(
      ({ projectId, branch, classification }) =>
        `${projectId}:${branch} ${classification.action} ${classification.kind}`,
    ),
  ];
}

function toV1Lines(verdicts: GoldenVerdicts) {
  const toLine = (key: string, { status, taskType }: GoldenVerdict) =>
    `${key} ${V1_ACTIONS[status]} ${V1_KINDS[taskType]}`;
  return [
    ...verdicts.issues.map((verdict) => toLine(`${verdict.projectId}#${verdict.iid}`, verdict)),
    ...verdicts.standaloneMergeRequests.map((verdict) =>
      toLine(`${verdict.projectId}!${verdict.iid}`, verdict),
    ),
    ...verdicts.standalonePushes.map((verdict) =>
      toLine(`${verdict.projectId}:${verdict.branch}`, verdict),
    ),
  ];
}

const names = readdirSync(DIRECTORY).filter(
  (name) => name.endsWith('.json') && !name.endsWith('.v1.json'),
);

describe('classification on the golden fixtures', () => {
  const traitService = new TraitService({} as TraitRepository);
  vi.spyOn(traitService, 'loadIndex').mockResolvedValue(createV1TraitIndex());
  const service = new ClassificationService(traitService, createBuilder(), createResolver());

  it.each(names)('%s gives the V1 action of every item', async (name) => {
    const fixture = readJson<GoldenFixture>(name);
    const day = await service.classify(
      fixture.day,
      {
        id: 'account',
        userId: 'user',
        source: Source.GITLAB,
        externalId: '1',
        username: fixture.username,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      fixture.role,
      fixture.date,
    );

    expect(toLines(day)).toEqual(toV1Lines(readJson(name.replace(/\.json$/, '.v1.json'))));
  });
});
