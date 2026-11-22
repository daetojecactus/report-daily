import { describe, expect, it } from 'vitest';
import { GitLabSourceNotes } from '../gitlab-source.notes';

describe('GitLabSourceNotes', () => {
  const notes = new GitLabSourceNotes();

  it('counts the kept, added and removed text of a description diff without spaces', () => {
    const diff = [
      '<span class="idiff">## Goal\n\nKeep it</span>',
      '<span class="idiff deletion">old ↵\nstep</span>',
      '<span class="idiff addition">new step &quot;one&quot;</span>',
      '<span class="idiff"> &lt;!-- note --&gt;</span>',
    ].join('');

    expect(notes.parseDescriptionDiff(diff)).toEqual({ before: 30, added: 12, removed: 7 });
  });

  it('counts nothing in a diff without parts', () => {
    expect(notes.parseDescriptionDiff('')).toEqual({ before: 0, added: 0, removed: 0 });
  });
});
