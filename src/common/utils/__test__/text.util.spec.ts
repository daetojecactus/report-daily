import { describe, expect, it } from 'vitest';
import { truncateText, withNotice } from '../text.util';

describe('truncateText', () => {
  it('keeps a text that fits', () => {
    expect(truncateText('Anna Ivanova', 12)).toBe('Anna Ivanova');
  });

  it('cuts a long text to the limit with an ellipsis and no space before it', () => {
    expect(truncateText('Anna Ivanova-Petrova', 12)).toBe('Anna Ivanov…');
    expect(truncateText('Anna Ivanova Petrova', 13)).toBe('Anna Ivanova…');
  });
});

describe('withNotice', () => {
  it('puts the notice under the title and keeps the lines without one', () => {
    expect(withNotice(['**Title**', 'Line'], 'Saved.')).toEqual([
      '**Title**',
      'Saved.',
      '',
      'Line',
    ]);
    expect(withNotice(['**Title**'], 'Saved.')).toEqual(['**Title**', 'Saved.']);
    expect(withNotice(['**Title**', 'Line'])).toEqual(['**Title**', 'Line']);
  });
});
