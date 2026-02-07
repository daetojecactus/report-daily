import { TaskAction } from '../../../common/enums/task.enum';

export interface EventTaskInfo {
  taskId: number | null;
  projectId: number;
  actionType: TaskAction;
}

export interface MergeContext {
  mergedBranches: Set<string>;
  acceptedMRs: Set<number>;
}

export interface CommentContext {
  hasOtherComments: boolean;
  iReplied: boolean;
  myCommentsCount: number;
  otherCommentsCount: number;
  hadMyCommentsBefore: boolean;
}

export interface MRInfo {
  iid: number;
  isAuthor: boolean;
  isAssignedToMe: boolean;
  isReviewer: boolean;
  hasReviewLabel: boolean;
  createdAt: Date;
  commentContext?: CommentContext;
}

export interface AIContext {
  commitMessages: string[];
  comments: string[];
  mrBranch?: string;
  mrTitle?: string;
}
