import { describe, expect, it } from 'vitest';
import { escapeMarkdown } from '../markdown.util';

describe('escapeMarkdown', () => {
  it('escapes markdown markers', () => {
    expect(escapeMarkdown('**[a_b](url)** `c` \\')).toBe(
      '\\*\\*\\[a\\_b\\](url)\\*\\* \\`c\\` \\\\',
    );
  });

  it('keeps plain text', () => {
    expect(escapeMarkdown('Иван Петров <dev> & co.')).toBe('Иван Петров <dev> & co.');
  });
});
