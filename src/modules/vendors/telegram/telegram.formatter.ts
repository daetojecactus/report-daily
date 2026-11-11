import { Injectable } from '@nestjs/common';
import type { MarkdownMarks } from 'src/common/types/markdown.interface';
import { renderMarkdown, splitMarkdown } from 'src/common/utils/markdown.util';
import {
  TELEGRAM_HTML_ESCAPES,
  TELEGRAM_HTML_SPECIAL_CHARACTERS,
  TELEGRAM_MESSAGE_LIMIT,
} from './constants/telegram-format.constants';

@Injectable()
export class TelegramFormatter {
  private readonly marks: MarkdownMarks = {
    text: (text) => this.escape(text),
    code: (code) => `<code>${this.escape(code)}</code>`,
    bold: (content) => `<b>${content}</b>`,
    italic: (content) => `<i>${content}</i>`,
    link: (content, url) => `<a href="${this.escape(url)}">${content}</a>`,
  };

  format(markdown: string): string {
    return renderMarkdown(markdown, this.marks);
  }

  split(markdown: string, limit = TELEGRAM_MESSAGE_LIMIT): string[] {
    return splitMarkdown(markdown, limit);
  }

  private escape(text: string) {
    return text.replace(TELEGRAM_HTML_SPECIAL_CHARACTERS, (char) => TELEGRAM_HTML_ESCAPES[char]);
  }
}
