import { describe, expect, it } from 'vitest';
import { toSourceKey } from '../source-name.util';

describe('toSourceKey', () => {
  it.each([
    ['status::doing', 'status::doing'],
    ['status::ready for QA', 'status::ready for qa'],
    ['status::QA in progress', 'status::qa in progress'],
    ['qa::Returned To  Development', 'qa::returned to development'],
    ['test::e2e required', 'test::e2e required'],
    ['bug', 'bug'],
    ['needs-rebase', 'needs-rebase'],
    ['workflow::qa::in review', 'workflow::qa::in review'],
    [' Status :: Doing ', 'status::doing'],
  ])('turns %j into %j', (label, key) => {
    expect(toSourceKey(label)).toBe(key);
  });

  it('treats an underscore and a space as the same', () => {
    expect(toSourceKey('status::after_review')).toBe('status::after review');
    expect(toSourceKey('status::after review')).toBe('status::after review');
  });
});
