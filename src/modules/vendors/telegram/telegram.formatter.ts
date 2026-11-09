import { Injectable } from '@nestjs/common';
import {
  TELEGRAM_HTML_ESCAPES,
  TELEGRAM_HTML_SPECIAL_CHARACTERS,
  TELEGRAM_LINK_PROTOCOLS,
  TELEGRAM_MESSAGE_LIMIT,
  TELEGRAM_SPLIT_SEPARATORS,
} from './constants/telegram.constants';

interface FormattedToken {
  html: string;
  end: number;
}

@Injectable()
export class TelegramFormatter {
  format(markdown: string): string {
    let html = '';
    let index = 0;
    while (index < markdown.length) {
      const token = this.readToken(markdown, index);
      html += token.html;
      index = token.end;
    }
    return html;
  }

  split(markdown: string, limit = TELEGRAM_MESSAGE_LIMIT): string[] {
    const parts: string[] = [];
    let rest = markdown;
    while (rest.length > limit) {
      const cut = this.findCut(rest, limit);
      parts.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    return [...parts, rest];
  }

  private findCut(text: string, limit: number) {
    const window = text.slice(0, limit + 1);
    for (const separator of TELEGRAM_SPLIT_SEPARATORS) {
      const index = window.lastIndexOf(separator);
      if (index > 0) {
        return index;
      }
    }
    let escapes = 0;
    while (text[limit - escapes - 1] === '\\') {
      escapes++;
    }
    return escapes % 2 === 1 ? limit - 1 : limit;
  }

  private readToken(markdown: string, index: number): FormattedToken {
    const char = markdown[index];
    if (char === '\\' && index + 1 < markdown.length) {
      return { html: this.escape(markdown[index + 1]), end: index + 2 };
    }
    if (char === '`') {
      const close = markdown.indexOf('`', index + 1);
      if (close > index + 1) {
        return {
          html: `<code>${this.escape(markdown.slice(index + 1, close))}</code>`,
          end: close + 1,
        };
      }
    }
    if (markdown.startsWith('**', index)) {
      const close = this.findClosing(markdown, '**', index + 2);
      if (close !== -1) {
        return {
          html: `<b>${this.format(markdown.slice(index + 2, close))}</b>`,
          end: close + 2,
        };
      }
    }
    if (char === '_') {
      const close = this.findClosing(markdown, '_', index + 1);
      if (close !== -1) {
        return {
          html: `<i>${this.format(markdown.slice(index + 1, close))}</i>`,
          end: close + 1,
        };
      }
    }
    if (char === '[') {
      const link = this.readLink(markdown, index);
      if (link) {
        return link;
      }
    }
    return { html: this.escape(char), end: index + 1 };
  }

  private readLink(markdown: string, index: number): FormattedToken | null {
    const textEnd = this.findClosing(markdown, ']', index + 1);
    if (textEnd === -1 || markdown[textEnd + 1] !== '(') {
      return null;
    }
    const urlEnd = markdown.indexOf(')', textEnd + 2);
    if (urlEnd === -1) {
      return null;
    }

    const text = this.format(markdown.slice(index + 1, textEnd));
    const url = markdown.slice(textEnd + 2, urlEnd);
    const isSafe = URL.canParse(url) && TELEGRAM_LINK_PROTOCOLS.includes(new URL(url).protocol);
    return {
      html: isSafe ? `<a href="${this.escape(url)}">${text}</a>` : text,
      end: urlEnd + 1,
    };
  }

  private findClosing(markdown: string, marker: string, from: number) {
    for (let index = from; index < markdown.length; index++) {
      if (markdown[index] === '\\') {
        index++;
        continue;
      }
      if (markdown.startsWith(marker, index)) {
        return index > from ? index : -1;
      }
    }
    return -1;
  }

  private escape(text: string) {
    return text.replace(TELEGRAM_HTML_SPECIAL_CHARACTERS, (char) => TELEGRAM_HTML_ESCAPES[char]);
  }
}
