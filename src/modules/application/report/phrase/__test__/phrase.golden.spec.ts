import { describe, expect, it } from 'vitest';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { Gender } from 'src/modules/application/user/types/user.enums';
import {
  classifyGoldenDays,
  GOLDEN_DIVERGENCES,
  isAcceptedByV1,
} from '../../activity/__test__/activity.golden.fixture';
import { PhraseService } from '../phrase.service';

type Reason = 'composite' | 'kind' | 'dependencies' | 'took_review' | 'new_signal';

const V1_PHRASES: Record<string, string> = {
  APPROVED_MR: 'Одобрил мердж-реквест',
  CLOSED_WITHOUT_MERGE: 'Закрыл задачу без мерджа',
  COMMENTED: 'Оставил комментарий',
  COMPLETED_BY_MERGE: 'Завершил задачу мерджем',
  CREATED: 'Создал задачу',
  DELEGATED_TASK: 'Назначил задачу в работу',
  FIXED_BUG: 'Исправил баг',
  FOUND_BUG: 'Обнаружил баг',
  IMPLEMENTED_FEATURE: 'Реализовал фичу',
  MERGED_OTHERS_WORK: 'Смерджил задачу коллеги',
  PLANNED_FEATURE: 'Запланировал фичу',
  PLANNED_FOR_SPRINT: 'Взял задачу в план спринта',
  PROVIDED_REQUIREMENTS: 'Уточнил требования',
  PUT_ON_HOLD: 'Отложил задачу',
  QA_AUTOMATION_DEVELOPED: 'Разрабатывал автотесты',
  QA_AWAITING_TESTING: 'Принял задачу в очередь на тестирование',
  REFACTORED_CODE: 'Провёл рефакторинг',
  REPORTED_BUG: 'Завёл баг-репорт',
  REVIEW_COMMENT: 'Оставил замечания по коду',
  STARTED_IMPLEMENTATION: 'Начал реализацию',
  TASK_SENT_TO_QA: 'Передал задачу на тестирование',
  TESTED_AND_APPROVED: 'Протестировал и подтвердил корректность',
  TESTED_WITH_COMMENTS: 'Провёл тестирование, оставил замечания',
  VERIFIED_FIX: 'Проверил исправление',
  WROTE_CODE: 'Работал над кодом',
};

const WORDING_CHANGES: Record<string, Reason> = {
  'developer-user-21-2026-11-03 12#87': 'composite',
  'developer-user-21-2026-11-04 12#87': 'kind',
  'developer-user-21-2026-11-05 16!14': 'dependencies',
  'developer-user-21-2026-11-05 21!51': 'dependencies',
  'developer-user-21-2026-11-05 8!525': 'dependencies',
  'qa-user-1-2026-10-30 1#749': 'composite',
  'qa-user-1-2026-11-02 14#909': 'composite',
  'qa-user-1-2026-11-03 14#826': 'took_review',
  'qa-user-1-2026-11-03 8#693': 'took_review',
  'qa-user-1-2026-11-04 1#748': 'composite',
  'qa-user-1-2026-11-04 1#749': 'composite',
  'qa-user-1-2026-11-04 5#1037': 'new_signal',
  'system_analyst-user-13-2026-10-29 7#1472': 'composite',
  'system_analyst-user-13-2026-11-04 8#694': 'composite',
};

describe('phrases on the golden days', () => {
  const locale = new I18nService().getLocale(Language.RU);
  const service = new PhraseService();
  const matched = classifyGoldenDays().lines.flatMap(({ key, status, result }) =>
    status && !(key in GOLDEN_DIVERGENCES) && isAcceptedByV1(status, result.choice.main)
      ? [{ key, status, result }]
      : [],
  );
  const toText = (result: (typeof matched)[number]['result']) => {
    const text = locale.phrases.actions[service.findPhrase(result.signals, result.choice.main)];
    return typeof text === 'string' ? text : text[Gender.MALE];
  };

  it('says what V1 said on every line where the action matches, except the documented changes', () => {
    const changed = matched.filter(({ status, result }) => toText(result) !== V1_PHRASES[status]);

    expect(matched).toHaveLength(78);
    expect(changed.map(({ key }) => key).toSorted()).toEqual(
      Object.keys(WORDING_CHANGES).toSorted(),
    );
    expect(
      Object.values(WORDING_CHANGES).reduce<Record<string, number>>(
        (total, reason) => ({ ...total, [reason]: (total[reason] ?? 0) + 1 }),
        {},
      ),
    ).toEqual({ composite: 7, kind: 1, dependencies: 3, took_review: 2, new_signal: 1 });
  });
});
