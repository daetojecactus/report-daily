import {
  LabelScope,
  LabelStatus,
  LabelQa,
  LabelTest,
} from '../enums/label.enum';
import {
  collectLabelValues,
  hasLabelValue,
  isInScope,
  isNeedsRebaseLabel,
  parseLabel,
  parseLabels,
} from './label.helper';

describe('label.helper', () => {
  describe('parseLabel', () => {
    it('разбирает scoped-лейбл на скоуп и значение', () => {
      expect(parseLabel('status::doing')).toEqual({
        scope: 'status',
        value: 'doing',
      });
    });

    it('нормализует регистр и пробелы в новых qa-лейблах', () => {
      expect(parseLabel('status::ready for QA')).toEqual({
        scope: 'status',
        value: LabelStatus.READY_FOR_QA,
      });
      expect(parseLabel('status::QA in progress')).toEqual({
        scope: 'status',
        value: LabelStatus.QA_IN_PROGRESS,
      });
      expect(parseLabel('qa::Returned To  Development')).toEqual({
        scope: 'qa',
        value: LabelQa.RETURNED_TO_DEVELOPMENT,
      });
      expect(parseLabel('test::e2e required')).toEqual({
        scope: 'test',
        value: LabelTest.E2E_REQUIRED,
      });
    });

    it('лейбл без скоупа отдаёт scope = null', () => {
      expect(parseLabel('bug')).toEqual({ scope: null, value: 'bug' });
    });

    it('подчёркивание и пробел в статусе считаются одним написанием', () => {
      expect(parseLabel('status::after_review').value).toBe(
        LabelStatus.AFTER_REVIEW,
      );
      expect(parseLabel('status::after review').value).toBe(
        LabelStatus.AFTER_REVIEW,
      );
    });

    it('во вложенном скоупе значением остаётся последний сегмент', () => {
      expect(parseLabel('workflow::qa::in review')).toEqual({
        scope: 'workflow::qa',
        value: 'in review',
      });
    });
  });

  describe('isInScope', () => {
    it('лейбл своего скоупа и безскоупный лейбл проходят проверку', () => {
      expect(isInScope(parseLabel('type::bug'), LabelScope.TYPE)).toBe(true);
      expect(isInScope(parseLabel('bug'), LabelScope.TYPE)).toBe(true);
    });

    it('лейбл чужого скоупа не проходит проверку', () => {
      expect(isInScope(parseLabel('status::bug'), LabelScope.TYPE)).toBe(false);
    });
  });

  describe('hasLabelValue', () => {
    it('различает одинаковые значения в разных скоупах', () => {
      const labels = parseLabels(['type::qa', 'qa::returned to development']);

      expect(hasLabelValue(labels, LabelScope.TYPE, 'qa')).toBe(true);
      expect(
        hasLabelValue(labels, LabelScope.QA, LabelQa.RETURNED_TO_DEVELOPMENT),
      ).toBe(true);
      expect(
        hasLabelValue(labels, LabelScope.STATUS, LabelStatus.QA_IN_PROGRESS),
      ).toBe(false);
    });
  });

  describe('isNeedsRebaseLabel', () => {
    it('распознаёт безскоупный needs-rebase', () => {
      expect(isNeedsRebaseLabel(parseLabel('needs-rebase'))).toBe(true);
      expect(isNeedsRebaseLabel(parseLabel('status::doing'))).toBe(false);
    });
  });

  describe('collectLabelValues', () => {
    it('возвращает только допустимые значения нужного скоупа', () => {
      const labels = parseLabels([
        'status::ready for QA',
        'status::unknown value',
        'qa::returned to development',
      ]);

      expect(
        collectLabelValues(
          labels,
          LabelScope.STATUS,
          Object.values(LabelStatus),
        ),
      ).toEqual([LabelStatus.READY_FOR_QA]);
    });
  });
});
