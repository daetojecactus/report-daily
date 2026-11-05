import {
  LABEL_SCOPE_SEPARATOR,
  LABEL_SPACES_PATTERN,
  LABEL_WORD_SEPARATOR_PATTERN,
} from '../constants/label.constants';

export function toLabelKey(label: string) {
  return label
    .split(LABEL_SCOPE_SEPARATOR)
    .map((part) =>
      part
        .toLowerCase()
        .replace(LABEL_WORD_SEPARATOR_PATTERN, ' ')
        .replace(LABEL_SPACES_PATTERN, ' ')
        .trim(),
    )
    .join(LABEL_SCOPE_SEPARATOR);
}
