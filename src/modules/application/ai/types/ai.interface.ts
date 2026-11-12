import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import type { TaskKind } from 'src/modules/application/trait/types/trait.enums';
import type { Gender, JobRole } from 'src/modules/application/user/types/user.enums';
import type { Language } from 'src/modules/application/i18n/types/i18n.enums';

export interface AiLine {
  id: string;
  action: string;
  title: string;
  kind: TaskKind | null;
  commits: string[];
  comments: string[];
  names: AiNames | null;
}

export interface AiNames {
  added: string[];
  removed: string[];
}

export interface AiPolicy {
  commits: boolean;
  comments: boolean;
}

export interface AiProfile {
  userId: string;
  role: JobRole;
  gender: Gender;
  language: Language;
  locale: Locale;
}

export interface AiRewording {
  texts: Map<string, string>;
  model: string | null;
}
