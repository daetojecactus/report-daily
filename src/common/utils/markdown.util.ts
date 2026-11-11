import {
  MARKDOWN_BOLD,
  MARKDOWN_CODE,
  MARKDOWN_ESCAPE,
  MARKDOWN_ITALIC,
  MARKDOWN_LINK_PROTOCOLS,
  MARKDOWN_LINK_TEXT_END,
  MARKDOWN_LINK_TEXT_START,
  MARKDOWN_LINK_URL_END,
  MARKDOWN_LINK_URL_START,
  MARKDOWN_SPECIAL_CHARACTERS,
  MARKDOWN_SPLIT_SEPARATORS,
} from '../constants/markdown.constants';
import type { MarkdownMarks } from '../types/markdown.interface';

interface MarkdownToken {
  text: string;
  end: number;
}

export function escapeMarkdown(text: string) {
  return text.replace(MARKDOWN_SPECIAL_CHARACTERS, '\\$&');
}

export function renderMarkdown(markdown: string, marks: MarkdownMarks): string {
  let rendered = '';
  let index = 0;
  while (index < markdown.length) {
    const token = readToken(markdown, index, marks);
    rendered += token.text;
    index = token.end;
  }
  return rendered;
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

function readToken(markdown: string, index: number, marks: MarkdownMarks): MarkdownToken {
  const char = markdown[index];
  if (char === MARKDOWN_ESCAPE && index + 1 < markdown.length) {
    return { text: marks.text(markdown[index + 1]), end: index + 2 };
  }
  if (char === MARKDOWN_CODE) {
    const close = markdown.indexOf(MARKDOWN_CODE, index + 1);
    if (close > index + 1) {
      return { text: marks.code(markdown.slice(index + 1, close)), end: close + 1 };
    }
  }
  if (markdown.startsWith(MARKDOWN_BOLD, index)) {
    const start = index + MARKDOWN_BOLD.length;
    const close = findClosing(markdown, MARKDOWN_BOLD, start);
    if (close !== -1) {
      const content = renderMarkdown(markdown.slice(start, close), marks);
      return { text: marks.bold(content), end: close + MARKDOWN_BOLD.length };
    }
  }
  if (char === MARKDOWN_ITALIC) {
    const close = findClosing(markdown, MARKDOWN_ITALIC, index + 1);
    if (close !== -1) {
      const content = renderMarkdown(markdown.slice(index + 1, close), marks);
      return { text: marks.italic(content), end: close + 1 };
    }
  }
  if (char === MARKDOWN_LINK_TEXT_START) {
    const link = readLink(markdown, index, marks);
    if (link) {
      return link;
    }
  }
  return { text: marks.text(char), end: index + 1 };
}

function readLink(markdown: string, index: number, marks: MarkdownMarks): MarkdownToken | null {
  const textEnd = findClosing(markdown, MARKDOWN_LINK_TEXT_END, index + 1);
  if (textEnd === -1 || markdown[textEnd + 1] !== MARKDOWN_LINK_URL_START) {
    return null;
  }
  const urlEnd = markdown.indexOf(MARKDOWN_LINK_URL_END, textEnd + 2);
  if (urlEnd === -1) {
    return null;
  }
  const content = renderMarkdown(markdown.slice(index + 1, textEnd), marks);
  const url = markdown.slice(textEnd + 2, urlEnd);
  const isSafe = URL.canParse(url) && MARKDOWN_LINK_PROTOCOLS.includes(new URL(url).protocol);
  return { text: isSafe ? marks.link(content, url) : content, end: urlEnd + 1 };
}

function findClosing(markdown: string, marker: string, from: number) {
  for (let index = from; index < markdown.length; index++) {
    if (markdown[index] === MARKDOWN_ESCAPE) {
      index++;
      continue;
    }
    if (markdown.startsWith(marker, index)) {
      return index > from ? index : -1;
    }
  }
  return -1;
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
