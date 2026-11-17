import { Injectable } from '@nestjs/common';
import type {
  Screen,
  ScreenButton,
  ScreenUserPicker,
} from 'src/common/channel/types/chat-channel.interface';
import { truncateText } from 'src/common/utils/text.util';
import {
  SLACK_ACTION_ID_PREFIX,
  SLACK_ACTION_ID_SEPARATOR,
  SLACK_ACTIONS_LIMIT,
  SLACK_BUTTON_STYLES,
  SLACK_BUTTON_TEXT_LIMIT,
  SLACK_EDGE_NEWLINES,
  SLACK_HEADER_TEXT_LIMIT,
  SLACK_SECTION_TEXT_LIMIT,
  SLACK_SPLIT_LIMIT,
  SLACK_USER_PICKER_ACTION,
} from './constants/slack-blocks.constants';
import { SlackBlockType, SlackElementType, SlackTextType } from './types/slack.enums';
import { SlackFormatter } from './slack.formatter';
import type {
  SlackActionsBlock,
  SlackHeaderBlock,
  SlackMessageContent,
  SlackSectionBlock,
} from './types/slack.interface';

@Injectable()
export class SlackRenderer {
  constructor(private readonly slackFormatter: SlackFormatter) {}

  render(screen: Screen): SlackMessageContent {
    const markdown = this.slackFormatter.formatCommands(screen.text);
    const [first, ...rest] = markdown.split('\n');
    const title = this.slackFormatter.toTitle(first);
    const header = title === null ? null : this.toHeader(title);
    const sections = this.toSections(title === null ? markdown : rest.join('\n'));
    const actions = screen.userPicker
      ? [this.toUserPicker(screen.userPicker)]
      : (screen.buttons ?? []).flatMap((row, index) => this.toActions(row, index));
    return {
      text: header?.text.text ?? sections[0]?.text.text ?? '',
      blocks: [...(header ? [header] : []), ...sections, ...actions],
    };
  }

  private toHeader(title: string): SlackHeaderBlock {
    return {
      type: SlackBlockType.HEADER,
      text: {
        type: SlackTextType.PLAIN,
        text: truncateText(title, SLACK_HEADER_TEXT_LIMIT),
        emoji: true,
      },
    };
  }

  private toSections(markdown: string): SlackSectionBlock[] {
    return this.toTexts(markdown, SLACK_SPLIT_LIMIT)
      .map((text) => text.replace(SLACK_EDGE_NEWLINES, ''))
      .filter((text) => text.trim().length > 0)
      .map((text) => ({
        type: SlackBlockType.SECTION,
        text: { type: SlackTextType.MRKDWN, text },
      }));
  }

  private toTexts(markdown: string, limit: number): string[] {
    return this.slackFormatter.split(markdown, limit).flatMap((part) => {
      const text = this.slackFormatter.format(part);
      return text.length > SLACK_SECTION_TEXT_LIMIT
        ? this.toTexts(part, Math.floor(limit / 2))
        : [text];
    });
  }

  private toActions(row: ScreenButton[], rowIndex: number): SlackActionsBlock[] {
    const blocks: SlackActionsBlock[] = [];
    for (let start = 0; start < row.length; start += SLACK_ACTIONS_LIMIT) {
      blocks.push({
        type: SlackBlockType.ACTIONS,
        elements: row.slice(start, start + SLACK_ACTIONS_LIMIT).map((button, offset) => ({
          type: SlackElementType.BUTTON,
          text: {
            type: SlackTextType.PLAIN,
            text: truncateText(button.text, SLACK_BUTTON_TEXT_LIMIT),
            emoji: true,
          },
          action_id: `${SLACK_ACTION_ID_PREFIX}${[rowIndex, start + offset].join(SLACK_ACTION_ID_SEPARATOR)}`,
          value: button.data,
          ...(button.style ? { style: SLACK_BUTTON_STYLES[button.style] } : {}),
        })),
      });
    }
    return blocks;
  }

  private toUserPicker(picker: ScreenUserPicker): SlackActionsBlock {
    return {
      type: SlackBlockType.ACTIONS,
      elements: [
        {
          type: SlackElementType.USERS_SELECT,
          action_id: SLACK_USER_PICKER_ACTION,
          placeholder: {
            type: SlackTextType.PLAIN,
            text: truncateText(picker.text, SLACK_BUTTON_TEXT_LIMIT),
            emoji: true,
          },
        },
      ],
    };
  }
}
