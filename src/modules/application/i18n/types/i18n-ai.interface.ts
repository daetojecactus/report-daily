import type { Gender, JobRole } from 'src/modules/application/user/types/user.enums';

export interface AiLocale {
  ai: {
    system: string;
    roles: Record<JobRole, string>;
    genders: Record<Gender, string>;
    request: (count: number) => string;
  };
}
