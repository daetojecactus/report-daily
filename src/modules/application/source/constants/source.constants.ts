import { SourceActionKind } from '../types/source.enums';

export const SOURCE_CLOSED_BY_MERGE_REQUEST = 'merge_request';

export const SOURCE_NAME_FACTS = new Set<SourceActionKind>([
  SourceActionKind.LABEL_ADDED,
  SourceActionKind.LABEL_REMOVED,
  SourceActionKind.STATUS_SET,
]);
