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

  it('splits long text by blank lines first', () => {
    const project = (name: string) => `${name}:\n${'• line\n'.repeat(3)}`.trimEnd();

    expect(formatter.split([project('a'), project('b')].join('\n\n'), 30)).toEqual([
      project('a'),
      project('b'),
    ]);
  });
});
