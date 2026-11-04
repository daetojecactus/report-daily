import { MARKDOWN_SPECIAL_CHARACTERS } from '../constants/markdown.constants';

export function escapeMarkdown(text: string) {
  return text.replace(MARKDOWN_SPECIAL_CHARACTERS, '\\$&');
}
