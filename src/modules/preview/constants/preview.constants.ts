import { ActivityReason } from 'src/modules/application/report/activity/types/activity.enums';
import { SourceTargetType } from 'src/modules/application/source/types/source.enums';

export const PREVIEW_INDENT = '  ';

export const PREVIEW_TRACE_FLAG = '--trace';

export const PREVIEW_LANGUAGE_FLAG = '--lang=';

export const PREVIEW_AI_FLAG = '--ai';

export const PREVIEW_AI_COMMENTS_FLAG = '--ai-comments';

export const PREVIEW_EMPTY_REPORT = '(no lines for the report)';

export const PREVIEW_REASONS: Record<ActivityReason, string> = {
  [ActivityReason.ONLY]: 'the only action',
  [ActivityReason.TIER]: 'a higher tier',
  [ActivityReason.WEIGHT]: 'a higher weight',
  [ActivityReason.TIME]: 'a later time',
};

export const PREVIEW_MINUTE_SECONDS = 60;

export const PREVIEW_HOUR_SECONDS = 60 * 60;

export const PREVIEW_TARGET_NAMES: Record<SourceTargetType, string> = {
  [SourceTargetType.WIKI_PAGE]: 'Wiki page',
  [SourceTargetType.MILESTONE]: 'Milestone',
};

export const PREVIEW_FIXTURE_EXTENSION = '.json';
