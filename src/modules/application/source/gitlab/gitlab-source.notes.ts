import { Injectable } from '@nestjs/common';
import type { GitLabNote } from 'src/modules/vendors/gitlab/gitlab.interface';
import {
  GITLAB_SOURCE_DATE_ACTIONS,
  GITLAB_SOURCE_DATE_CHANGE_PATTERN,
  GITLAB_SOURCE_DATE_NOTE_PATTERN,
  GITLAB_SOURCE_KNOWN_NOTES,
  GITLAB_SOURCE_MENTION_PATTERN,
  GITLAB_SOURCE_NOTE_ACTIONS,
  GITLAB_SOURCE_NOTE_SHAPE_REPLACEMENTS,
  GITLAB_SOURCE_NOTE_SHAPE_WORDS,
  GITLAB_SOURCE_TIME_SPENT_PATTERN,
  GITLAB_SOURCE_TIME_UNIT_PATTERN,
  GITLAB_SOURCE_TIME_UNITS,
} from './constants/gitlab-source.constants';
import type { SourceUserChange } from './gitlab-source.interface';

@Injectable()
export class GitLabSourceNotes {
  match(note: GitLabNote) {
    if (!note.system) {
      return null;
    }
    for (const { pattern, kind } of GITLAB_SOURCE_NOTE_ACTIONS) {
      const match = pattern.exec(note.body);
      if (match) {
        return { kind, value: match[1] ?? null };
      }
    }
    return null;
  }

  parseDateChanges(note: GitLabNote) {
    if (!note.system || !GITLAB_SOURCE_DATE_NOTE_PATTERN.test(note.body)) {
      return [];
    }
    return [...note.body.matchAll(GITLAB_SOURCE_DATE_CHANGE_PATTERN)].flatMap(
      ([, action, field, date]) => {
        const kind = GITLAB_SOURCE_DATE_ACTIONS.get(`${action} ${field}`);
        return kind ? [{ kind, value: date ?? null }] : [];
      },
    );
  }

  parseTimeSpent(note: GitLabNote) {
    const match = note.system ? GITLAB_SOURCE_TIME_SPENT_PATTERN.exec(note.body) : null;
    if (!match) {
      return null;
    }
    const [, action, duration, date, time, zoneHours, zoneMinutes] = match;
    const seconds = [...duration.matchAll(GITLAB_SOURCE_TIME_UNIT_PATTERN)].reduce(
      (total, [, amount, unit]) => total + Number(amount) * (GITLAB_SOURCE_TIME_UNITS[unit] ?? 0),
      0,
    );
    const zone = zoneHours ? `${zoneHours}:${zoneMinutes}` : 'Z';
    return {
      seconds: action === 'added' ? seconds : -seconds,
      at: date ? `${date}T${time ?? '00:00:00'}${zone}` : note.created_at,
    };
  }

  isKnown(note: GitLabNote) {
    return GITLAB_SOURCE_KNOWN_NOTES.some((pattern) => pattern.test(note.body));
  }

  toShape(note: GitLabNote) {
    const [line = ''] = note.body.split('\n');
    return GITLAB_SOURCE_NOTE_SHAPE_REPLACEMENTS.reduce(
      (text, [pattern, replacement]) => text.replace(pattern, replacement),
      line,
    )
      .trim()
      .split(' ')
      .slice(0, GITLAB_SOURCE_NOTE_SHAPE_WORDS)
      .join(' ');
  }

  parseUserChange(note: GitLabNote, change: SourceUserChange) {
    const { body } = note;
    const isAdded = body.startsWith(change.added);
    if (!note.system || (!isAdded && !body.startsWith(change.removed))) {
      return { added: [], removed: [] };
    }
    const removedAt = body.indexOf(change.removed);
    return {
      added: isAdded
        ? this.toMentions(body.slice(0, removedAt === -1 ? undefined : removedAt))
        : [],
      removed: removedAt === -1 ? [] : this.toMentions(body.slice(removedAt)),
    };
  }

  private toMentions(text: string) {
    return [...text.matchAll(GITLAB_SOURCE_MENTION_PATTERN)].map(([, username]) => username);
  }
}
