import { TEXT_ELLIPSIS } from '../constants/text.constants';

export function truncateText(text: string, max: number) {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - TEXT_ELLIPSIS.length)).trimEnd()}${TEXT_ELLIPSIS}`;
}

export function withNotice(lines: string[], notice?: string) {
  if (!notice) {
    return lines;
  }
  const [title, ...rest] = lines;
  return [title, notice, ...(rest.length ? ['', ...rest] : [])];
}
