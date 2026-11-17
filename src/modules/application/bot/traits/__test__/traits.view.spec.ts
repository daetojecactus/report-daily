import { describe, expect, it } from 'vitest';
import { TraitsView } from '../traits.view';

describe('TraitsView', () => {
  const view = new TraitsView();

  it('keeps a label that fits', () => {
    expect(view.toItemLabel('status::doing', 'in progress')).toBe('status::doing · in progress');
  });

  it('cuts only the GitLab name of a long label', () => {
    expect(view.toItemLabel('status::waiting-for-the-customer', 'on hold')).toBe(
      'status::waiting-for-t… · on hold',
    );
  });

  it('keeps at least the start of the name next to a long value', () => {
    expect(view.toItemLabel('priority::critical', 'Needed right now by the whole team')).toBe(
      'priorit… · Needed right now by the whole team',
    );
  });
});
