import {
  MARKDOWN_ESCAPE,
  MARKDOWN_SPECIAL_CHARACTERS,
  MARKDOWN_SPLIT_SEPARATORS,
} from '../constants/markdown.constants';

export function escapeMarkdown(text: string) {
  return text.replace(MARKDOWN_SPECIAL_CHARACTERS, '\\$&');
}

export function splitMarkdown(markdown: string, limit: number): string[] {
  const parts: string[] = [];
  let rest = markdown;
  while (rest.length > limit) {
    const cut = findCut(rest, limit);
    parts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  return [...parts, rest];
}

function findCut(text: string, limit: number) {
  const window = text.slice(0, limit + 1);
  for (const separator of MARKDOWN_SPLIT_SEPARATORS) {
    const index = window.lastIndexOf(separator);
    if (index > 0) {
      return index;
    }
  }
  let escapes = 0;
  while (text[limit - escapes - 1] === MARKDOWN_ESCAPE) {
    escapes++;
  }
  return escapes % 2 === 1 ? limit - 1 : limit;
}
