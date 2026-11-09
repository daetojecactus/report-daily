import { SourceActionKind } from '../source.enums';

export const SOURCE_NAME_FACTS = new Set<SourceActionKind>([
  SourceActionKind.LABEL_ADDED,
  SourceActionKind.LABEL_REMOVED,
  SourceActionKind.STATUS_SET,
]);
