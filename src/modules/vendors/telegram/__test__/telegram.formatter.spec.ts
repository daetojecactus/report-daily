import { describe, expect, it } from 'vitest';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import { TelegramFormatter } from '../telegram.formatter';

const HTML_TAG = /<(\/?)(\w+)[^>]*>/g;

const formatter = new TelegramFormatter();

function hasBalancedTags(html: string) {
  const openTags: string[] = [];
  for (const [, closing, name] of html.matchAll(HTML_TAG)) {
    if (!closing) {
      openTags.push(name);
    } else if (openTags.pop() !== name) {
      return false;
    }
  }
  return openTags.length === 0;
}

describe('TelegramFormatter', () => {
  it('escapes HTML special characters in plain text', () => {
    expect(formatter.format(`a & b < c > d "e" 'f'`)).toBe(
      `a &amp; b &lt; c &gt; d &quot;e&quot; 'f'`,
    );
  });

  it('formats bold', () => {
    expect(formatter.format('**bold** text')).toBe('<b>bold</b> text');
  });

  it('formats italic', () => {
    expect(formatter.format('text _italic_')).toBe('text <i>italic</i>');
  });

  it('escapes HTML inside formatting', () => {
    expect(formatter.format('**<a> & b** _"c"_')).toBe(
      '<b>&lt;a&gt; &amp; b</b> <i>&quot;c&quot;</i>',
    );
  });

  it('formats code with escaping and without formatting inside', () => {
    expect(formatter.format('run `a < b && **c** _d_ \\_e [f](http://x)` now')).toBe(
      'run <code>a &lt; b &amp;&amp; **c** _d_ \\_e [f](http://x)</code> now',
    );
  });

  it('formats nested bold and italic', () => {
    expect(formatter.format('**bold _italic_**')).toBe('<b>bold <i>italic</i></b>');
    expect(formatter.format('_italic **bold**_')).toBe('<i>italic <b>bold</b></i>');
  });

  it.each([
    ['\\*\\*not bold\\*\\*', '**not bold**'],
    ['a\\_b', 'a_b'],
    ['\\`not code\\`', '`not code`'],
    ['\\[a\\](https://x.y)', '[a](https://x.y)'],
    ['a\\\\b', 'a\\b'],
    ['\\<b\\>', '&lt;b&gt;'],
  ])('renders escaped characters in %s literally', (markdown, html) => {
    expect(formatter.format(markdown)).toBe(html);
  });

  it('skips escaped markers when looking for the closing marker', () => {
    expect(formatter.format('**a\\*\\*b** _c\\_d_')).toBe('<b>a**b</b> <i>c_d</i>');
  });

  it.each(['**a', '_a', '`a', 'a**', '[a](https://x.y', '[a] b', 'a\\'])(
    'keeps the unclosed marker in %s literally',
    (markdown) => {
      expect(formatter.format(markdown)).toBe(markdown);
    },
  );

  it.each(['****', '__', '``', '[](https://x.y)'])(
    'keeps the empty markers in %s literally',
    (markdown) => {
      expect(formatter.format(markdown)).toBe(markdown);
    },
  );

  it('formats a link and escapes its url', () => {
    expect(formatter.format('[text](https://x.y/?a=1&b=2)')).toBe(
      '<a href="https://x.y/?a=1&amp;b=2">text</a>',
    );
  });

  it('formats the link text', () => {
    expect(formatter.format('see [**a** & b](http://x.y/a_b_c)')).toBe(
      'see <a href="http://x.y/a_b_c"><b>a</b> &amp; b</a>',
    );
  });

  it('escapes quotes in the link url', () => {
    expect(formatter.format('[a](https://x.y/"onclick="b)')).toBe(
      '<a href="https://x.y/&quot;onclick=&quot;b">a</a>',
    );
  });

  it.each([
    ['[run](javascript:alert)', 'run'],
    ['[run](JavaScript:alert)', 'run'],
    ['[file](ftp://x.y/file)', 'file'],
    ['[page](/page)', 'page'],
    ['[page](x.y/page)', 'page'],
    ['[<mail>](mailto:a@x.y)', '&lt;mail&gt;'],
  ])('renders only the text of the unsafe link %s', (markdown, html) => {
    expect(formatter.format(markdown)).toBe(html);
  });

  it('closes italic before an unclosed bold marker', () => {
    expect(formatter.format('_a **b_ c**')).toBe('<i>a **b</i> c**');
  });

  it.each([
    '_a **b_ c**',
    '**a _b** c_',
    '**a `b** c`',
    '`a **b` c**',
    '***a***',
    '**_a**_',
    '_**a_**',
    '[a **b](https://x.y) c**',
    '**a [b** c](https://x.y)',
    '[a](https://x.y) _b [c_](https://z.w)',
    '[[a](https://x.y)](https://z.w)',
  ])('keeps tags balanced for %s', (markdown) => {
    expect(hasBalancedTags(formatter.format(markdown))).toBe(true);
  });

  it('keeps Cyrillic text', () => {
    expect(formatter.format('Привет, мир! Ёжик — 100%')).toBe('Привет, мир! Ёжик — 100%');
    expect(formatter.format('**Отчёт** за _сегодня_')).toBe('<b>Отчёт</b> за <i>сегодня</i>');
  });

  it('renders escaped data as plain text', () => {
    const data = '**[a_b](https://x.y)** `c` \\ <d> & "e"';

    expect(formatter.format(`**${escapeMarkdown(data)}**`)).toBe(
      '<b>**[a_b](https://x.y)** `c` \\ &lt;d&gt; &amp; &quot;e&quot;</b>',
    );
  });

  describe('split', () => {
    const project = (name: string, lines: number) =>
      [`${name}:`, ...Array.from({ length: lines }, (_, index) => `• **Line** ${index}`)].join(
        '\n',
      );

    it('keeps a short text whole', () => {
      expect(formatter.split('project:\n• line')).toEqual(['project:\n• line']);
    });

    it('cuts between projects first, then between lines, then at a space', () => {
      const report = [project('a', 3), project('b', 3)].join('\n\n');

      expect(formatter.split(report, 60)).toEqual([project('a', 3), project('b', 3)]);
      expect(formatter.split(project('a', 6), 50)).toEqual([
        project('a', 3),
        '• **Line** 3\n• **Line** 4\n• **Line** 5',
      ]);
      expect(formatter.split('one two three four', 9)).toEqual(['one two', 'three', 'four']);
    });

    it('keeps every part within the limit with its tags balanced', () => {
      const report = Array.from({ length: 40 }, (_, index) => project(`p${index}`, 30)).join(
        '\n\n',
      );
      const parts = formatter.split(report);

      expect(parts.length).toBeGreaterThan(1);
      expect(parts.every((part) => part.length <= 4096)).toBe(true);
      expect(parts.join('\n\n')).toBe(report);
      expect(parts.every((part) => hasBalancedTags(formatter.format(part)))).toBe(true);
    });

    it('does not cut an escape in a word longer than the limit', () => {
      expect(formatter.split('aaaa\\*bbbb', 5)).toEqual(['aaaa', '\\*bbb', 'b']);
      expect(formatter.split('aaa\\\\bbbb', 5)).toEqual(['aaa\\\\', 'bbbb']);
    });
  });
});
