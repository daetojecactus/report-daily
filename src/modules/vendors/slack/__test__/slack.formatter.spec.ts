import { describe, expect, it } from 'vitest';
import { SlackFormatter } from '../slack.formatter';

describe('SlackFormatter', () => {
  const formatter = new SlackFormatter();

  it.each([
    ['**Done** today', '*Done* today'],
    ['_api_ project', '_api_ project'],
    ['run `pnpm test`', 'run `pnpm test`'],
    ['**Fixed _the_ bug**', '*Fixed _the_ bug*'],
    [
      '[Login form](https://gitlab.example.com/a/-/issues/1)',
      '<https://gitlab.example.com/a/-/issues/1|Login form>',
    ],
    ['[click](javascript:alert)', 'click'],
    ['a < b && c > d', 'a &lt; b &amp;&amp; c &gt; d'],
    ['`<b>`', '`&lt;b&gt;`'],
    ['Price \\*5\\* and snake\\_case', 'Price *5* and snake_case'],
    ['**not closed', '**not closed'],
  ])('formats %j', (markdown, mrkdwn) => {
    expect(formatter.format(markdown)).toBe(mrkdwn);
  });

  it.each([
    ['/help', '/report-daily help'],
    ['Bot settings — /admin.', 'Bot settings — /report-daily admin.'],
    ['`/report` always works', '`/report-daily report` always works'],
    ['(/settings → Template)', '(/report-daily settings → Template)'],
    ['https://example.com/report', 'https://example.com/report'],
    ['src/help and ./start', 'src/help and ./start'],
    ['/report-daily and /reporting', '/report-daily and /reporting'],
  ])('writes the command in %j as the Slack command', (markdown, text) => {
    expect(formatter.formatCommands(markdown)).toBe(text);
  });

  it.each([
    ['a &lt; b &amp;&amp; c &gt; d', 'a < b && c > d'],
    ['{% if lines.size &gt; 0 %}', '{% if lines.size > 0 %}'],
    ['ask <@U0ANNA01> or <@U0BORIS1|boris>', 'ask U0ANNA01 or U0BORIS1'],
    ['see <#C0GENERAL|general> and <#C0RANDOM>', 'see #general and #C0RANDOM'],
    ['<!here> <!channel|@channel> <!subteam^S0TEAM|@devs>', '@here @channel @devs'],
    ['<https://example.com/a?x=1&amp;y=2>', 'https://example.com/a?x=1&y=2'],
    ['<http://example.com|example.com> <mailto:a@b.co|a@b.co>', 'example.com a@b.co'],
    ['<https://example.com/docs|the docs>', 'the docs (https://example.com/docs)'],
    ['plain text', 'plain text'],
  ])('reads the Slack text %j as typed', (text, plain) => {
    expect(formatter.toPlainText(text)).toBe(plain);
  });

  it('splits long text by blank lines first', () => {
    const project = (name: string) => `${name}:\n${'• line\n'.repeat(3)}`.trimEnd();

    expect(formatter.split([project('a'), project('b')].join('\n\n'), 30)).toEqual([
      project('a'),
      project('b'),
    ]);
  });
});
