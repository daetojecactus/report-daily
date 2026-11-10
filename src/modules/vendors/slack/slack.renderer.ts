import { Injectable } from '@nestjs/common';
import type {
  Screen,
  ScreenButton,
  ScreenUserPicker,
} from 'src/common/interfaces/chat-channel.interface';
import {
  SLACK_ACTION_ID_PREFIX,
  SLACK_ACTION_ID_SEPARATOR,
  SLACK_ACTIONS_LIMIT,
  SLACK_BUTTON_TEXT_LIMIT,
  SLACK_CUT_MARK,
  SLACK_USER_PICKER_ACTION,
} from './constants/slack.constants';
import { SlackBlockType, SlackElementType, SlackTextType } from './slack.enums';
import { SlackFormatter } from './slack.formatter';
import type { SlackActionsBlock, SlackMessageContent, SlackSectionBlock } from './slack.interface';

@Injectable()
export class SlackRenderer {
  constructor(private readonly slackFormatter: SlackFormatter) {}

  render(screen: Screen): SlackMessageContent {
    const sections = this.toSections(this.slackFormatter.formatCommands(screen.text));
    const actions = screen.userPicker
      ? [this.toUserPicker(screen.userPicker)]
      : (screen.buttons ?? []).flatMap((row, index) => this.toActions(row, index));
    return { text: sections[0]?.text.text ?? '', blocks: [...sections, ...actions] };
  }

  private toSections(markdown: string): SlackSectionBlock[] {
    return this.slackFormatter
      .split(markdown)
      .map((part) => this.slackFormatter.format(part))
      .filter((text) => text.trim().length > 0)
      .map((text) => ({
        type: SlackBlockType.SECTION,
        text: { type: SlackTextType.MRKDWN, text },
      }));
  }

  private toActions(row: ScreenButton[], rowIndex: number): SlackActionsBlock[] {
    const blocks: SlackActionsBlock[] = [];
    for (let start = 0; start < row.length; start += SLACK_ACTIONS_LIMIT) {
      blocks.push({
        type: SlackBlockType.ACTIONS,
        elements: row.slice(start, start + SLACK_ACTIONS_LIMIT).map((button, offset) => ({
          type: SlackElementType.BUTTON,
          text: { type: SlackTextType.PLAIN, text: this.cut(button.text), emoji: true },
          action_id: `${SLACK_ACTION_ID_PREFIX}${[rowIndex, start + offset].join(SLACK_ACTION_ID_SEPARATOR)}`,
          value: button.data,
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
          placeholder: { type: SlackTextType.PLAIN, text: this.cut(picker.text), emoji: true },
        },
      ],
    };
  }

  private cut(text: string) {
    return text.length > SLACK_BUTTON_TEXT_LIMIT
      ? `${text.slice(0, SLACK_BUTTON_TEXT_LIMIT - 1)}${SLACK_CUT_MARK}`
      : text;
  }
}
