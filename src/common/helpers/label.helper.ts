import { LABEL_NEEDS_REBASE } from '../enums/label.enum';
import type { LabelScope } from '../enums/label.enum';

//разобранный лейбл gitlab: «status::ready for QA» → { scope: 'status', value: 'ready for qa' }
export interface ParsedLabel {
  scope: string | null;
  value: string;
}

//нормализация части лейбла: нижний регистр, подчёркивания как пробелы, схлопывание пробелов
//«after_review» и «after review» — один и тот же статус, в проектах встречаются оба написания
function normalizeLabelPart(part: string): string {
  return part.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
}

//разбирает лейбл на скоуп и значение (вложенные скоупы «a::b::c» → scope «a::b», value «c»)
export function parseLabel(label: string): ParsedLabel {
  const parts = label.split('::');

  if (parts.length === 1) {
    return { scope: null, value: normalizeLabelPart(parts[0]) };
  }

  return {
    scope: normalizeLabelPart(parts.slice(0, -1).join('::')),
    value: normalizeLabelPart(parts[parts.length - 1]),
  };
}

//разбирает список лейблов
export function parseLabels(labels: string[]): ParsedLabel[] {
  return labels.map(parseLabel);
}

//лейбл принадлежит скоупу: точное совпадение либо лейбл без скоупа («bug» вместо «type::bug»)
export function isInScope(label: ParsedLabel, scope: LabelScope): boolean {
  return label.scope === scope || label.scope === null;
}

//есть ли в списке лейбл с указанным значением в нужном скоупе
export function hasLabelValue(
  labels: ParsedLabel[],
  scope: LabelScope,
  value: string,
): boolean {
  return labels.some(
    (label) => isInScope(label, scope) && label.value === value,
  );
}

//значения из списка допустимых, присутствующие в лейблах нужного скоупа
export function collectLabelValues<T extends string>(
  labels: ParsedLabel[],
  scope: LabelScope,
  allowedValues: readonly T[],
): T[] {
  return allowedValues.filter((value) => hasLabelValue(labels, scope, value));
}

//безскоупный лейбл «needs-rebase»
export function isNeedsRebaseLabel(label: ParsedLabel): boolean {
  return label.scope === null && label.value === LABEL_NEEDS_REBASE;
}
