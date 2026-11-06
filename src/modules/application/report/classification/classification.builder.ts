import { Injectable } from '@nestjs/common';
import { LabelAction, SourceEventAction } from 'src/modules/application/source/source.enums';
import type {
  CleanEvent,
  CleanLabelEvent,
  CleanNote,
  GroupedIssue,
  GroupedMergeRequest,
} from 'src/modules/application/source/source.interface';
import { Priority, TaskFlag, TraitDimension } from 'src/modules/application/trait/trait.enums';
import type { TaskTraits, TraitIndex } from 'src/modules/application/trait/trait.interface';
import { TraitService } from 'src/modules/application/trait/trait.service';
import { CLASSIFICATION_APPROVED_NOTE } from './constants/classification.constants';
import { TaskContext } from './classification.context';
import { TaskRole } from './classification.enums';
import type { ClassificationEmployee, TaskTraitSignals } from './classification.interface';

@Injectable()
export class ClassificationBuilder {
  constructor(private readonly traitService: TraitService) {}

  buildIssueContext(
    issue: GroupedIssue,
    employee: ClassificationEmployee,
    index: TraitIndex,
    reportDate: string,
  ) {
    const mergeRequest = issue.mergeRequests.at(0) ?? null;
    const mergeRequestEvents = mergeRequest?.events ?? [];
    const mergeRequestNotes = mergeRequest?.notes ?? [];
    const approved = this.hasAction(mergeRequestEvents, SourceEventAction.APPROVED);
    const traits = this.traitService.toTaskTraits(index, issue.labels);
    return new TaskContext({
      role: employee.role,
      taskRole: this.resolveTaskRole(
        issue.assignees.at(0) ?? null,
        mergeRequest?.reviewers ?? [],
        employee.username,
        issue.events,
        approved,
      ),
      isMergeRequestAuthor: mergeRequest?.author === employee.username,
      kind: traits.kinds.at(0) ?? null,
      dates: {
        mergeRequestCreatedAt: mergeRequest?.createdAt ?? null,
        mergeRequestLastCommitAt: mergeRequest?.lastCommitAt ?? null,
        reportDate,
      },
      traits: this.buildTraitSignals(traits, issue.labelEvents, employee.username, index),
      activity: {
        issueState: issue.state,
        mergeRequestState: mergeRequest?.state ?? null,
        issueClosedOnReportDate: issue.closedOnReportDate,
        mergeRequestMergedOnReportDate: mergeRequest?.mergedOnReportDate ?? false,
        issueActions: issue.events.map((event) => event.actionName),
        mergeRequestActions: mergeRequestEvents.map((event) => event.actionName),
        issueCommentsFromEmployee: this.countComments(issue.notes, employee.username),
        mergeRequestCommentsFromEmployee: this.countComments(mergeRequestNotes, employee.username),
        mergeRequestCommentsFromOthers: this.countOtherComments(
          mergeRequestNotes,
          employee.username,
        ),
        mergeRequestCommitCount: this.countCommits(mergeRequestEvents),
        commitTitles: this.findCommitTitles(mergeRequestEvents),
        reviewThreadCount: mergeRequest?.reviewThreads.total ?? 0,
        unresolvedReviewThreadCount: mergeRequest?.reviewThreads.unresolved ?? 0,
      },
      approvals: {
        employeeApproved: approved,
        otherApprovers: this.findOtherApprovers(mergeRequestNotes, employee.username),
      },
    });
  }

  buildMergeRequestContext(
    mergeRequest: GroupedMergeRequest,
    employee: ClassificationEmployee,
    index: TraitIndex,
    reportDate: string,
  ) {
    const approved = this.hasAction(mergeRequest.events, SourceEventAction.APPROVED);
    const traits = this.traitService.toTaskTraits(index, mergeRequest.labels);
    return new TaskContext({
      role: employee.role,
      taskRole: this.resolveTaskRole(
        mergeRequest.assignees.at(0) ?? null,
        mergeRequest.reviewers,
        employee.username,
        mergeRequest.events,
        approved,
      ),
      isMergeRequestAuthor: mergeRequest.author === employee.username,
      kind: traits.kinds.at(0) ?? null,
      dates: {
        mergeRequestCreatedAt: mergeRequest.createdAt,
        mergeRequestLastCommitAt: mergeRequest.lastCommitAt,
        reportDate,
      },
      traits: this.buildTraitSignals(traits, mergeRequest.labelEvents, employee.username, index),
      activity: {
        issueState: null,
        mergeRequestState: mergeRequest.state,
        issueClosedOnReportDate: false,
        mergeRequestMergedOnReportDate: mergeRequest.mergedOnReportDate,
        issueActions: [],
        mergeRequestActions: mergeRequest.events.map((event) => event.actionName),
        issueCommentsFromEmployee: 0,
        mergeRequestCommentsFromEmployee: this.countComments(mergeRequest.notes, employee.username),
        mergeRequestCommentsFromOthers: this.countOtherComments(
          mergeRequest.notes,
          employee.username,
        ),
        mergeRequestCommitCount: this.countCommits(mergeRequest.events),
        commitTitles: this.findCommitTitles(mergeRequest.events),
        reviewThreadCount: mergeRequest.reviewThreads.total,
        unresolvedReviewThreadCount: mergeRequest.reviewThreads.unresolved,
      },
      approvals: {
        employeeApproved: approved,
        otherApprovers: this.findOtherApprovers(mergeRequest.notes, employee.username),
      },
    });
  }

  private resolveTaskRole(
    assignee: string | null,
    reviewers: string[],
    username: string,
    events: CleanEvent[],
    approved: boolean,
  ) {
    if (assignee === username) {
      return TaskRole.ASSIGNEE;
    }
    if (reviewers.includes(username) || approved) {
      return TaskRole.REVIEWER;
    }
    if (
      this.hasAction(events, SourceEventAction.OPENED) ||
      this.hasAction(events, SourceEventAction.CREATED)
    ) {
      return TaskRole.AUTHOR;
    }
    return TaskRole.OBSERVER;
  }

  private buildTraitSignals(
    traits: TaskTraits,
    labelEvents: CleanLabelEvent[],
    username: string,
    index: TraitIndex,
  ): TaskTraitSignals {
    const additions = labelEvents.filter((event) => event.action === LabelAction.ADD);
    const ownAdditions = additions.filter((event) => event.username === username);
    const stateAdditions = additions
      .toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .flatMap((event) => this.findValues(index, event, TraitDimension.WORKFLOW_STATE));
    return {
      kinds: traits.kinds,
      priority: traits.priority,
      currentState: stateAdditions.at(0) ?? null,
      previousState: stateAdditions.at(1) ?? null,
      activeStates: traits.workflowStates,
      statesSetByEmployee: ownAdditions.flatMap((event) =>
        this.findValues(index, event, TraitDimension.WORKFLOW_STATE),
      ),
      priorityEscalatedByEmployee: ownAdditions.some((event) =>
        this.findValues(index, event, TraitDimension.PRIORITY).includes(Priority.CRITICAL),
      ),
      flags: [
        ...new Set([
          ...traits.flags,
          ...additions.flatMap((event) => this.findValues(index, event, TraitDimension.FLAG)),
        ]),
      ],
      flagsSetByEmployee: ownAdditions.flatMap((event) =>
        this.findValues(index, event, TraitDimension.FLAG),
      ),
      needsRebaseResolved: labelEvents.some(
        (event) =>
          event.action === LabelAction.REMOVE &&
          this.findValues(index, event, TraitDimension.FLAG).includes(TaskFlag.NEEDS_REBASE),
      ),
    };
  }

  private findValues<Dimension extends TraitDimension>(
    index: TraitIndex,
    event: CleanLabelEvent,
    dimension: Dimension,
  ) {
    return this.traitService.findValues(index, event.labelName, dimension);
  }

  private hasAction(events: CleanEvent[], action: SourceEventAction) {
    return events.map((event) => event.actionName).includes(action);
  }

  private countComments(notes: CleanNote[], username: string) {
    return notes.filter((note) => !note.system && note.authorUsername === username).length;
  }

  private countOtherComments(notes: CleanNote[], username: string) {
    return notes.filter((note) => !note.system && note.authorUsername !== username).length;
  }

  private countCommits(events: CleanEvent[]) {
    return events.reduce((total, event) => total + (event.pushData?.commitCount ?? 0), 0);
  }

  private findCommitTitles(events: CleanEvent[]) {
    return events.flatMap((event) =>
      event.pushData?.commitTitle ? [event.pushData.commitTitle] : [],
    );
  }

  private findOtherApprovers(notes: CleanNote[], username: string) {
    return [
      ...new Set(
        notes
          .filter(
            (note) =>
              note.system &&
              note.authorUsername !== username &&
              note.body.toLowerCase().includes(CLASSIFICATION_APPROVED_NOTE),
          )
          .map((note) => note.authorUsername),
      ),
    ];
  }
}
