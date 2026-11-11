import { Injectable } from '@nestjs/common';
import { MARKDOWN_LINK_PROTOCOLS } from 'src/common/constants/markdown.constants';
import { splitMarkdown } from 'src/common/utils/markdown.util';
import {
  SLACK_CHANNEL_MARK,
  SLACK_COMMAND_MENTION,
  SLACK_ESCAPED_CHARACTERS,
  SLACK_ESCAPES,
  SLACK_MARKUP,
  SLACK_SPECIAL_CHARACTERS,
  SLACK_SPECIAL_MARK,
  SLACK_UNESCAPES,
  SLACK_URL_SCHEME,
  SLACK_USER_MARK,
} from './constants/slack-format.constants';
import { SLACK_SLASH_COMMAND } from './constants/slack-events.constants';
import { SLACK_SPLIT_LIMIT } from './constants/slack-blocks.constants';

interface FormattedToken {
  text: string;
  end: number;
}

@Injectable()
export class SlackFormatter {
  format(markdown: string): string {
    let text = '';
    let index = 0;
    while (index < markdown.length) {
      const token = this.readToken(markdown, index);
      text += token.text;
      index = token.end;
    }
    return text;
  }

  formatCommands(markdown: string) {
    return markdown.replace(
      SLACK_COMMAND_MENTION,
      (_, before: string, word: string) => `${before}${SLACK_SLASH_COMMAND} ${word}`,
    );
  }

  split(markdown: string, limit = SLACK_SPLIT_LIMIT): string[] {
    return splitMarkdown(markdown, limit);
  }

  toPlainText(text: string) {
    return text
      .replace(SLACK_MARKUP, (_, target: string, label: string | undefined) =>
        this.readMarkup(target, label),
      )
      .replace(SLACK_ESCAPED_CHARACTERS, (entity) => SLACK_UNESCAPES[entity]);
  }

  private readMarkup(target: string, label: string | undefined) {
    const name = target.slice(1);
    switch (target[0]) {
      case SLACK_USER_MARK:
        return name;
      case SLACK_CHANNEL_MARK:
        return `${SLACK_CHANNEL_MARK}${label || name}`;
      case SLACK_SPECIAL_MARK:
        return label || `${SLACK_USER_MARK}${name}`;
      default:
        return !label || label === target || label === target.replace(SLACK_URL_SCHEME, '')
          ? label || target
          : `${label} (${target})`;
    }
  }

  private readToken(markdown: string, index: number): FormattedToken {
    const char = markdown[index];
    if (char === '\\' && index + 1 < markdown.length) {
      return { text: this.escape(markdown[index + 1]), end: index + 2 };
    }
    if (char === '`') {
      const close = markdown.indexOf('`', index + 1);
      if (close > index + 1) {
        return { text: `\`${this.escape(markdown.slice(index + 1, close))}\``, end: close + 1 };
      }
    }
    if (markdown.startsWith('**', index)) {
      const close = this.findClosing(markdown, '**', index + 2);
      if (close !== -1) {
        return { text: `*${this.format(markdown.slice(index + 2, close))}*`, end: close + 2 };
      }
    }
    if (char === '_') {
      const close = this.findClosing(markdown, '_', index + 1);
      if (close !== -1) {
        return { text: `_${this.format(markdown.slice(index + 1, close))}_`, end: close + 1 };
      }
    }
    if (char === '[') {
      const link = this.readLink(markdown, index);
      if (link) {
        return link;
      }
    }
    return { text: this.escape(char), end: index + 1 };
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
    const isSafe = URL.canParse(url) && MARKDOWN_LINK_PROTOCOLS.includes(new URL(url).protocol);
    return { text: isSafe ? `<${this.escape(url)}|${text}>` : text, end: urlEnd + 1 };
  }

  private findClosing(markdown: string, marker: string, from: number) {
    for (let index = from; index < markdown.length; index++) {
      if (markdown[index] === '\\') {
        index++;
        continue;
      }
      if (markdown.startsWith(marker, index)) {
        return index;
      }
    }
    return -1;
  }

  private escape(text: string) {
    return text.replace(SLACK_SPECIAL_CHARACTERS, (char) => SLACK_ESCAPES[char]);
  }
}
