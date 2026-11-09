import { describe, expect, it } from 'vitest';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import {
  ItemState,
  SourceActionKind,
  SourceEventAction,
  SourceRefType,
} from 'src/modules/application/source/source.enums';
import { Gender, JobRole } from 'src/modules/application/user/user.enums';
import { ActivityAction } from '../../activity/activity.enums';
import type { ActivityLine } from '../../activity/activity.interface';
import {
  at,
  choose,
  createIssue,
  createMergeRequest,
  fact,
  issueLine,
  othersMergeRequest,
  pushLine,
  refEvent,
  toSignals,
} from '../../activity/__test__/activity.fixture';
import { PHRASE_RULES } from '../constants/phrase.constants';
import { ReportPhrase } from '../phrase.enums';
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
      'Fixed a bug after testing "Issue 12"',
    );
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
      'Протестировал и подтвердил корректность «Merge request 5»',
    );
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
    ).toBe('Оставил комментарий «Issue 12» · задача на тестировании');
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
    ).toBe('Left a comment "Issue 12" · task closed');
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
    ).toBe('Отправил изменения в несколько веток');
  });
});
