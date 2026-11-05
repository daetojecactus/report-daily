import {
  SOURCE_NAME_SCOPE_SEPARATOR,
  SOURCE_NAME_SPACES_PATTERN,
  SOURCE_NAME_WORD_SEPARATOR_PATTERN,
} from '../constants/source-name.constants';

export function toSourceKey(label: string) {
  return label
    .split(SOURCE_NAME_SCOPE_SEPARATOR)
    .map((part) =>
      part
        .toLowerCase()
        .replace(SOURCE_NAME_WORD_SEPARATOR_PATTERN, ' ')
        .replace(SOURCE_NAME_SPACES_PATTERN, ' ')
        .trim(),
    )
    .join(SOURCE_NAME_SCOPE_SEPARATOR);
}
