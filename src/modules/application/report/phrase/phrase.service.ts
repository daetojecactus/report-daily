import { Injectable } from '@nestjs/common';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import { ItemState } from 'src/modules/application/source/source.enums';
import type { WorkflowState } from 'src/modules/application/trait/trait.enums';
import type { Gender } from 'src/modules/application/user/user.enums';
import { ActivityAction } from '../activity/activity.enums';
import type {
  ActivityCandidate,
  ActivityLine,
  ActivityLineSignals,
  ActivityResult,
} from '../activity/activity.interface';
import {
  PHRASE_CONTEXT_ACTIONS,
  PHRASE_CONTEXTS,
  PHRASE_NOTED_ACTIONS,
  PHRASE_RULES,
} from './constants/phrase.constants';
import { ReportPhrase } from './phrase.enums';
import type { PhraseRule } from './phrase.interface';

@Injectable()
export class PhraseService {
  describe({ line, signals, choice }: ActivityResult, gender: Gender, locale: Locale) {
    const texts = locale.phrases;
    const { main } = choice;
    const state = this.toStateText(locale, line, signals.endStates);
    const action = texts.actions[this.findPhrase(signals, main)];
    const phrase =
      main.action === ActivityAction.STATE_ONLY && state
        ? texts.stateLine(state)
        : typeof action === 'string'
          ? action
          : action[gender];
    const context = this.findContext(main);
    const title = this.toTitle(line);
    const text = [
      phrase,
      ...(context ? [texts.contexts[context]] : []),
      ...(title ? [texts.quote(title)] : []),
    ].join(' ');
    return PHRASE_NOTED_ACTIONS.has(main.action) && line.issue && state
      ? texts.withNote(text, texts.stateNote(state))
      : text;
  }

  findPhrase(signals: ActivityLineSignals, candidate: ActivityCandidate) {
    return (
      PHRASE_RULES.find((rule) => this.matches(rule, signals, candidate))?.phrase ??
      ReportPhrase.WORKED_ON_TASK
    );
  }

  findContext(candidate: ActivityCandidate) {
    if (!PHRASE_CONTEXT_ACTIONS.has(candidate.action)) {
      return null;
    }
    return PHRASE_CONTEXTS.find(([detail]) => candidate.details.includes(detail))?.[1] ?? null;
  }

  private matches(rule: PhraseRule, signals: ActivityLineSignals, candidate: ActivityCandidate) {
    const includesAll = <T>(values: T[], required: T[] = []) =>
      required.every((value) => values.includes(value));
    const includesAny = <T>(value: T, allowed?: T[]) => !allowed || allowed.includes(value);
    return (
      rule.action === candidate.action &&
      includesAll(candidate.details, rule.details) &&
      includesAll(signals.kinds, rule.kinds) &&
      includesAll(signals.endFlags, rule.flags) &&
      includesAny(signals.employee.role, rule.roles) &&
      (!rule.states || (candidate.state !== null && rule.states.includes(candidate.state))) &&
      (!rule.endStates || signals.endStates.some((state) => rule.endStates?.includes(state))) &&
      (rule.issue === undefined || rule.issue === (signals.line.issue !== null)) &&
      (rule.pushed === undefined || rule.pushed === signals.pushes.length > 0) &&
      (rule.assignee === undefined || rule.assignee === signals.assignee) &&
      (rule.merged === undefined || rule.merged === signals.mergedToday)
    );
  }

  private toStateText(locale: Locale, line: ActivityLine, states: WorkflowState[]) {
    if (line.issue?.state === ItemState.CLOSED) {
      return locale.phrases.closed;
    }
    const state = states.at(-1);
    return state ? locale.phrases.states[state] : null;
  }

  private toTitle(line: ActivityLine) {
    return (
      line.issue?.title ??
      line.mergeRequests.at(0)?.title ??
      line.event?.title ??
      line.pushes.at(0)?.ref ??
      null
    );
  }
}
