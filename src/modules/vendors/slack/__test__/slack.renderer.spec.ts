import { describe, expect, it } from 'vitest';
import { SlackBlockType } from '../types/slack.enums';
import { SlackFormatter } from '../slack.formatter';
import { SlackRenderer } from '../slack.renderer';

describe('SlackRenderer', () => {
  const renderer = new SlackRenderer(new SlackFormatter());

  it('draws the text as a section and the button rows as action blocks', () => {
    expect(
      renderer.render({
        text: '**Settings**\nLanguage: English',
        buttons: [
          [
            { text: 'Language', data: 'set:lang' },
            { text: 'Report time', data: 'set:time' },
          ],
          [{ text: 'Menu', data: 'adm:menu' }],
        ],
      }),
    ).toEqual({
      text: '*Settings*\nLanguage: English',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: '*Settings*\nLanguage: English' } },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Language', emoji: true },
              action_id: 'button-0-0',
              value: 'set:lang',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Report time', emoji: true },
              action_id: 'button-0-1',
              value: 'set:time',
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Menu', emoji: true },
              action_id: 'button-1-0',
              value: 'adm:menu',
            },
          ],
        },
      ],
    });
  });

  it('keeps at most 25 buttons in an action block and cuts long button texts', () => {
    const row = Array.from({ length: 30 }, (_, index) => ({
      text: `${'x'.repeat(80)}${index}`,
      data: `rpt:day:${index}`,
    }));

    const { blocks } = renderer.render({ text: 'Days', buttons: [row] });

    expect(
      blocks.map((block) => (block.type === SlackBlockType.ACTIONS ? block.elements.length : 0)),
    ).toEqual([0, 25, 5]);
    const last = blocks[2];
    expect(last.type === SlackBlockType.ACTIONS && last.elements[4]).toMatchObject({
      action_id: 'button-0-29',
      value: 'rpt:day:29',
      text: { text: `${'x'.repeat(74)}…` },
    });
  });

  it('draws the user picker as a users select', () => {
    expect(
      renderer.render({ text: 'Pick', userPicker: { text: 'Choose a member' } }).blocks[1],
    ).toEqual({
      type: 'actions',
      elements: [
        {
          type: 'users_select',
          action_id: 'pick-user',
          placeholder: { type: 'plain_text', text: 'Choose a member', emoji: true },
        },
      ],
    });
  });

  it('writes the bot commands in the text as the Slack command', () => {
    expect(renderer.render({ text: 'Commands — /help' }).text).toBe(
      'Commands — /report-daily help',
    );
  });

  it('splits a part again when escaping makes it longer than Slack allows', () => {
    const { blocks } = renderer.render({ text: '&'.repeat(2700) });

    const texts = blocks.map((block) =>
      block.type === SlackBlockType.SECTION ? block.text.text : '',
    );
    expect(texts.every((text) => text.length <= 3000)).toBe(true);
    expect(texts.join('')).toBe('&amp;'.repeat(2700));
  });

  it('puts a long text into several sections and skips an empty one', () => {
    const text = Array.from({ length: 4 }, (_, index) => `${index}${'a'.repeat(1500)}`).join(
      '\n\n',
    );

    expect(renderer.render({ text }).blocks).toHaveLength(4);
    expect(renderer.render({ text: '', buttons: [[{ text: 'Ok', data: 'x:y' }]] }).blocks).toEqual([
      expect.objectContaining({ type: 'actions' }),
    ]);
  });
});
