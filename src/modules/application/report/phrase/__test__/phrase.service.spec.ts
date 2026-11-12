import { describe, expect, it } from 'vitest';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { SOURCE_CLOSED_BY_MERGE_REQUEST } from 'src/modules/application/source/constants/source.constants';
import {
  ItemState,
  SourceActionKind,
  SourceEventAction,
  SourceRefType,
} from 'src/modules/application/source/types/source.enums';
import { Gender, JobRole } from 'src/modules/application/user/types/user.enums';
import { ActivityAction, ActivityDetail } from '../../activity/types/activity.enums';
import type { ActivityCandidate, ActivityLine } from '../../activity/types/activity.interface';
import {
  at,
  choose,
  createIndex,
  createIssue,
  createService,
  createMergeRequest,
  fact,
  issueLine,
  othersMergeRequest,
  ME,
  otherFact,
  pushEvent,
  pushLine,
  refEvent,
  toSignals,
} from '../../activity/__test__/activity.fixture';
import { PHRASE_RULES } from '../constants/phrase-rules.constants';
import { PhraseContext, ReportPhrase } from '../types/phrase.enums';
import { PhraseService } from '../phrase.service';

function describeLine(
  line: ActivityLine,
  { role = JobRole.DEVELOPER, gender = Gender.MALE, language = Language.RU } = {},
) {
  return new PhraseService().describe(
    { line, signals: toSignals(line, role), choice: choose(line, role), excluded: false },
    gender,
    new I18nService().getLocale(language),
  );
}

function mergedBug() {
  const mergeRequest = createMergeRequest({
    mergedOnReportDate: true,
    facts: [fact(SourceActionKind.MERGED, at(15))],
  });
  return issueLine(
    createIssue({
      labels: ['type::bug'],
      startOfDay: { ...createIssue().startOfDay, labels: ['type::bug', 'status::qa passed'] },
      mergeRequests: [mergeRequest],
    }),
  );
}

const SPRINT = '2026-11-05 – 2026-11-18';

function planned(
  iid: number,
  facts = [fact(SourceActionKind.ITERATION_SET, at(10), { value: SPRINT })],
) {
  return createIssue({ iid, title: `Issue ${iid}`, facts });
}

function summarize(
  issues: ReturnType<typeof createIssue>[],
  { gender = Gender.MALE, language = Language.RU } = {},
) {
  const service = createService();
  const results = service.classify(
    {
      projects: [],
      issues,
      standaloneMergeRequests: [],
      standalonePushes: [],
      standaloneEvents: [],
    },
    { username: ME, role: JobRole.PROJECT_MANAGER },
    createIndex(),
  );
  return service
    .summarize(results)
    .map((summary) =>
      new PhraseService().summarize(summary, gender, new I18nService().getLocale(language)),
    );
}

function mergeRequestLine(mergeRequest = createMergeRequest()): ActivityLine {
  return { issue: null, mergeRequests: [mergeRequest], pushes: [], event: null };
}

describe('PhraseService', () => {
  it('has a phrase for every action and uses every phrase', () => {
    const fallbacks = PHRASE_RULES.filter((rule) => Object.keys(rule).length === 2);

    expect(
      Object.values(ActivityAction).filter(
        (action) => !fallbacks.some((rule) => rule.action === action),
      ),
    ).toEqual([]);
    expect(
      Object.values(ReportPhrase).filter(
        (phrase) => !PHRASE_RULES.some((rule) => rule.phrase === phrase),
      ),
    ).toEqual([]);
  });

  it('names the outcome by the task kind and tells after what it came, in both forms and languages', () => {
    expect(describeLine(mergedBug())).toBe('Исправил баг после тестирования «Issue 12»');
    expect(describeLine(mergedBug(), { gender: Gender.FEMALE })).toBe(
      'Исправила баг после тестирования «Issue 12»',
    );
    expect(describeLine(mergedBug(), { language: Language.EN })).toBe(
      'Fixed a bug after testing “Issue 12”',
    );
  });

  it('does not tell after what it came when a part of the action already says it', () => {
    const part = (action: ActivityAction) => ({ action }) as ActivityCandidate;
    const merged = {
      action: ActivityAction.MERGED_OTHER,
      details: [ActivityDetail.AFTER_APPROVAL],
      parts: [] as ActivityCandidate[],
    } as ActivityCandidate;
    const service = new PhraseService();

    expect(service.findContext(merged)).toBe(PhraseContext.AFTER_APPROVAL);
    expect(
      service.findContext({
        ...merged,
        parts: [part(ActivityAction.APPROVED), part(ActivityAction.MERGED_OTHER)],
      }),
    ).toBeNull();
  });

  it('takes an urgent merge request without a task for a hotfix', () => {
    expect(
      describeLine(
        mergeRequestLine(
          createMergeRequest({
            labels: ['priority::critical'],
            mergedOnReportDate: true,
            facts: [fact(SourceActionKind.MERGED, at(15))],
          }),
        ),
      ),
    ).toBe('Выпустил хотфикс «Merge request 5»');
  });

  it('words an approval by the role of the employee', () => {
    const approved = mergeRequestLine(
      othersMergeRequest({ facts: [fact(SourceActionKind.APPROVED, at(11))] }),
    );

    expect(describeLine(approved)).toBe('Одобрил мердж-реквест «Merge request 5»');
    expect(describeLine(approved, { role: JobRole.QA })).toBe(
      'Протестировал и одобрил «Merge request 5»',
    );
  });

  it('says that a task passed testing with an approval only when there was one', () => {
    const passed = (facts = [fact(SourceActionKind.APPROVED, at(13))]) =>
      issueLine(
        createIssue({
          labels: ['status::qa passed'],
          facts: [fact(SourceActionKind.LABEL_ADDED, at(14), { value: 'status::qa passed' })],
          mergeRequests: [othersMergeRequest({ facts })],
        }),
      );

    expect(describeLine(passed(), { role: JobRole.QA })).toBe('Протестировал и одобрил «Issue 12»');
    expect(describeLine(passed([]), { role: JobRole.QA })).toBe(
      'Протестировал без замечаний «Issue 12»',
    );
    expect(describeLine(passed([]), { gender: Gender.FEMALE })).toBe(
      'Отметила, что задача прошла тестирование «Issue 12»',
    );
  });

  it('words a review handed over, a reviewer assigned and comments of a tester', () => {
    const request = fact(SourceActionKind.REVIEW_REQUESTED, at(10), { users: ['dev.third'] });
    const leave = fact(SourceActionKind.REVIEW_REQUEST_REMOVED, at(10), { users: [ME] });
    const comment = fact(SourceActionKind.COMMENTED, at(11));
    const line = (facts: ReturnType<typeof fact>[]) =>
      mergeRequestLine(othersMergeRequest({ title: 'Draft: Resolve "Fix  the login "', facts }));

    expect(describeLine(line([request, leave]), { role: JobRole.QA })).toBe(
      'Передал проверку коллеге «Fix the login»',
    );
    expect(describeLine(line([request]))).toBe('Назначил ревьюера «Fix the login»');
    expect(describeLine(line([comment]), { role: JobRole.QA, language: Language.EN })).toBe(
      'Commented on “Fix the login”',
    );
    expect(describeLine(line([comment]))).toBe('Оставил замечания по коду «Fix the login»');
  });

  it('tells who merged the changes that completed a task', () => {
    const completed = issueLine(
      createIssue({
        closedOnReportDate: true,
        mergeRequests: [othersMergeRequest({ mergedOnReportDate: true })],
      }),
    );
    const closed = issueLine(
      createIssue({
        facts: [fact(SourceActionKind.CLOSED, at(14), { value: SOURCE_CLOSED_BY_MERGE_REQUEST })],
        mergeRequests: [createMergeRequest({ facts: [fact(SourceActionKind.CLOSED, at(15))] })],
      }),
    );

    expect(describeLine(completed)).toBe('Завершил задачу, изменения влиты «Issue 12»');
    expect(describeLine(closed)).toBe('Влил изменения и завершил задачу «Issue 12»');
  });

  it('finishes the work of a task that passed testing the same day', () => {
    expect(
      describeLine(
        issueLine(
          createIssue({
            labels: ['status::qa passed'],
            facts: [
              otherFact(SourceActionKind.LABEL_ADDED, at(14), { value: 'status::qa passed' }),
            ],
            mergeRequests: [createMergeRequest({ events: [pushEvent(at(11))] })],
          }),
        ),
        { gender: Gender.FEMALE },
      ),
    ).toBe('Завершила работу, задача прошла тестирование «Issue 12»');
  });

  it('builds E2E coverage only as a tester', () => {
    const merged = issueLine(
      createIssue({
        labels: ['test::e2e required'],
        mergeRequests: [
          createMergeRequest({
            mergedOnReportDate: true,
            facts: [fact(SourceActionKind.MERGED, at(15))],
          }),
        ],
      }),
    );

    expect(describeLine(merged, { role: JobRole.QA })).toBe('Разработал E2E-покрытие «Issue 12»');
    expect(describeLine(merged)).toBe('Влил изменения и завершил задачу «Issue 12»');
  });

  it('adds the state of the task to a weak own action', () => {
    expect(
      describeLine(
        issueLine(
          createIssue({
            labels: ['status::testing'],
            facts: [fact(SourceActionKind.COMMENTED, at(10))],
          }),
        ),
      ),
    ).toBe('Прокомментировал «Issue 12» · задача на тестировании');
    expect(
      describeLine(
        issueLine(
          createIssue({
            state: ItemState.CLOSED,
            facts: [fact(SourceActionKind.COMMENTED, at(10))],
          }),
        ),
        { language: Language.EN },
      ),
    ).toBe('Commented on “Issue 12” · task closed');
  });

  it('describes a line without own actions by the state of the task', () => {
    expect(describeLine(issueLine(createIssue({ labels: ['status::testing'] })))).toBe(
      'Задача на тестировании «Issue 12»',
    );
    expect(describeLine(issueLine(createIssue({ state: ItemState.CLOSED })))).toBe(
      'Задача закрыта «Issue 12»',
    );
    expect(describeLine(issueLine(createIssue()), { gender: Gender.FEMALE })).toBe(
      'Работала над задачей «Issue 12»',
    );
  });

  it('names a tag by itself and leaves a push to many branches without a title', () => {
    expect(
      describeLine(
        pushLine({
          ref: 'v1.4.0',
          refType: SourceRefType.TAG,
          events: [
            refEvent(at(11), SourceEventAction.PUSHED_NEW, {
              refType: SourceRefType.TAG,
              ref: 'v1.4.0',
            }),
          ],
        }),
      ),
    ).toBe('Выпустил версию «v1.4.0»');
    expect(
      describeLine(
        pushLine({
          ref: null,
          events: [
            refEvent(at(11), SourceEventAction.PUSHED_TO, {
              ref: null,
              refCount: 5,
              commitCount: 0,
            }),
          ],
        }),
      ),
    ).toBe('Отправил изменения в 5 веток');
  });

  it('names the sprint, the milestone and the date in the language of the report', () => {
    expect(describeLine(issueLine(planned(12)))).toBe(
      'Взял задачу в спринт 5–18 ноября «Issue 12»',
    );
    expect(describeLine(issueLine(planned(12)), { language: Language.EN })).toBe(
      'Added the task to sprint 5\u2009–\u200918 November “Issue 12”',
    );
    expect(
      describeLine(
        issueLine(
          createIssue({
            startOfDay: { ...createIssue().startOfDay, milestone: '17.4' },
            facts: [fact(SourceActionKind.MILESTONE_SET, at(10), { value: '17.5' })],
          }),
        ),
        { gender: Gender.FEMALE },
      ),
    ).toBe('Перенесла задачу в веху 17.5 «Issue 12»');
    expect(
      describeLine(
        issueLine(
          createIssue({
            facts: [fact(SourceActionKind.DUE_DATE_SET, at(10), { value: '2026-11-20' })],
          }),
        ),
      ),
    ).toBe('Назначил срок задачи на 20 ноября «Issue 12»');
  });

  it('names the project a task came from and counts the subtasks in the right form', () => {
    expect(
      describeLine(
        issueLine(
          createIssue({
            facts: [fact(SourceActionKind.MOVED_IN, at(10), { value: 'team/old#7' })],
          }),
        ),
      ),
    ).toBe('Перенёс задачу из проекта team/old «Issue 12»');
    const decomposed = (count: number) =>
      issueLine(
        createIssue({
          facts: Array.from({ length: count }, (_, index) =>
            fact(SourceActionKind.CHILD_ADDED, at(10, index)),
          ),
        }),
      );
    expect(describeLine(decomposed(1))).toBe('Декомпозировал задачу на 1 подзадачу «Issue 12»');
    expect(describeLine(decomposed(3))).toBe('Декомпозировал задачу на 3 подзадачи «Issue 12»');
    expect(describeLine(decomposed(5), { language: Language.EN })).toBe(
      'Broke the task down into 5 subtasks “Issue 12”',
    );
  });

  it('phrases a summary with the value all its lines share', () => {
    expect(summarize([planned(1), planned(2), planned(3)])).toEqual([
      'Взял 3 задачи в спринт 5–18 ноября: #1, #2, #3',
    ]);
    expect(
      summarize(
        [
          planned(1),
          planned(2),
          planned(3, [fact(SourceActionKind.ITERATION_SET, at(10), { value: 'Sprint 9' })]),
          planned(4),
          planned(5),
        ],
        { gender: Gender.FEMALE },
      ),
    ).toEqual(['Взяла 5 задач в спринт: #1, #2, #3, #4, #5']);
    expect(summarize([planned(1), planned(2), planned(3)], { language: Language.EN })).toEqual([
      'Added 3 tasks to sprint 5\u2009–\u200918 November: #1, #2, #3',
    ]);
  });

  it('sums up the priorities set and changed in several tasks', () => {
    const prioritized = (iid: number, start: string[] = []) =>
      createIssue({
        iid,
        labels: ['priority::high'],
        startOfDay: { ...createIssue().startOfDay, labels: start },
        facts: [fact(SourceActionKind.LABEL_ADDED, at(10), { value: 'priority::high' })],
      });
    const changed = [1, 2, 3].map((iid) => prioritized(iid, ['priority::critical']));

    expect(summarize([prioritized(1), prioritized(2), prioritized(3)])).toEqual([
      'Назначил приоритет 3 задачам: #1, #2, #3',
    ]);
    expect(summarize(changed, { gender: Gender.FEMALE })).toEqual([
      'Изменила приоритет у 3 задач: #1, #2, #3',
    ]);
    expect(summarize(changed, { language: Language.EN })).toEqual([
      'Changed the priority of 3 tasks: #1, #2, #3',
    ]);
    expect(describeLine(issueLine(prioritized(12)), { role: JobRole.PROJECT_MANAGER })).toBe(
      'Назначил приоритет «Issue 12»',
    );
  });
});
