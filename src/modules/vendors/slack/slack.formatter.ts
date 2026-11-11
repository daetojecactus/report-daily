import { Injectable } from '@nestjs/common';
import type { MarkdownMarks } from 'src/common/types/markdown.interface';
import { renderMarkdown, splitMarkdown } from 'src/common/utils/markdown.util';
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

@Injectable()
export class SlackFormatter {
  private readonly marks: MarkdownMarks = {
    text: (text) => this.escape(text),
    code: (code) => `\`${this.escape(code)}\``,
    bold: (content) => `*${content}*`,
    italic: (content) => `_${content}_`,
    link: (content, url) => `<${this.escape(url)}|${content}>`,
  };

  format(markdown: string): string {
    return renderMarkdown(markdown, this.marks);
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

  private escape(text: string) {
    return text.replace(SLACK_SPECIAL_CHARACTERS, (char) => SLACK_ESCAPES[char]);
  }
}
