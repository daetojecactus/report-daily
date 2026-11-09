import { Injectable } from '@nestjs/common';
import type { GenderedText, Locale } from 'src/modules/application/i18n/i18n.interface';
import { ItemState, SourceActionKind } from 'src/modules/application/source/source.enums';
import type { WorkflowState } from 'src/modules/application/trait/trait.enums';
import type { Gender } from 'src/modules/application/user/user.enums';
import { ActivityAction } from '../activity/activity.enums';
import type {
  ActivityCandidate,
  ActivityLine,
  ActivityLineSignals,
  ActivityResult,
  ActivitySummary,
} from '../activity/activity.interface';
import {
  PHRASE_CONTEXT_ACTIONS,
  PHRASE_CONTEXTS,
  PHRASE_COUNTS,
  PHRASE_DATE_FORMAT,
  PHRASE_DATE_PATTERN,
  PHRASE_DATE_RANGE_PATTERN,
  PHRASE_DATE_TIME_SUFFIX,
  PHRASE_ISSUE_PREFIX,
  PHRASE_MERGE_REQUEST_PREFIX,
  PHRASE_NAME_FACTS,
  PHRASE_NAMES,
  PHRASE_NOTED_ACTIONS,
  PHRASE_REFERENCE_SEPARATOR,
  PHRASE_REFERENCE_SUFFIX_PATTERN,
  PHRASE_RULES,
  PHRASE_SUMMARIES,
  PHRASE_SUMMARY_NAMES,
} from './constants/phrase.constants';
import { PhraseCount, PhraseName, ReportPhrase } from './phrase.enums';
import type { PhraseRule, SummaryPhrase } from './phrase.interface';

@Injectable()
export class PhraseService {
  describe({ line, signals, choice }: ActivityResult, gender: Gender, locale: Locale) {
    const texts = locale.phrases;
    const { main } = choice;
    const state = this.toStateText(locale, line, signals.endStates);
    const key = this.findPhrase(signals, main);
    const phrase =
      main.action === ActivityAction.STATE_ONLY && state
        ? texts.stateLine(state)
        : `${this.toGendered(texts.actions[key], gender)}${this.toValue(locale, key, line, main)}`;
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

  summarize({ results }: ActivitySummary, gender: Gender, locale: Locale) {
    const [first] = results;
    const key = this.findPhrase(first.signals, first.choice.main);
    const phrase: SummaryPhrase = this.isSummaryPhrase(key) ? key : ReportPhrase.TASK_PLANNED;
    const nameKind = PHRASE_NAMES.get(phrase);
    const names = new Set(
      results.map(({ choice }) => (nameKind ? this.findName(locale, nameKind, choice.main) : null)),
    );
    const name = names.size === 1 ? [...names][0] : null;
    const value =
      nameKind && PHRASE_SUMMARY_NAMES.has(nameKind) ? locale.phrases.names[nameKind](name) : '';
    return locale.phrases.summaryLine(
      `${this.toGendered(locale.phrases.summaries[phrase](results.length), gender)}${value}`,
      results.map(({ line }) => this.toReference(locale, line)).join(PHRASE_REFERENCE_SEPARATOR),
    );
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

  private toValue(
    locale: Locale,
    phrase: ReportPhrase,
    line: ActivityLine,
    candidate: ActivityCandidate,
  ) {
    const nameKind = PHRASE_NAMES.get(phrase);
    if (nameKind) {
      return locale.phrases.names[nameKind](this.findName(locale, nameKind, candidate));
    }
    const countKind = PHRASE_COUNTS.get(phrase);
    return countKind
      ? locale.phrases.counts[countKind](this.findCount(countKind, line, candidate))
      : '';
  }

  private findName(locale: Locale, kind: PhraseName, candidate: ActivityCandidate) {
    const value = candidate.facts.find(
      (fact) => PHRASE_NAME_FACTS[kind].includes(fact.kind) && fact.value,
    )?.value;
    if (!value) {
      return null;
    }
    return kind === PhraseName.PROJECT
      ? value.replace(PHRASE_REFERENCE_SUFFIX_PATTERN, '')
      : this.formatDates(locale, value);
  }

  private findCount(kind: PhraseCount, line: ActivityLine, candidate: ActivityCandidate) {
    if (kind === PhraseCount.SUBTASKS) {
      return candidate.facts.filter((fact) => fact.kind === SourceActionKind.CHILD_ADDED).length;
    }
    const counts = line.pushes
      .flatMap((push) => push.events)
      .map((event) => event.pushData?.refCount ?? null)
      .filter((count) => count !== null);
    return counts.length ? counts.reduce((total, count) => total + count, 0) : null;
  }

  private formatDates(locale: Locale, value: string) {
    const format = new Intl.DateTimeFormat(locale.phrases.dateLocale, PHRASE_DATE_FORMAT);
    const toDate = (date: string) => new Date(`${date}${PHRASE_DATE_TIME_SUFFIX}`);
    return value
      .replace(PHRASE_DATE_RANGE_PATTERN, (_, start: string, end: string) =>
        format.formatRange(toDate(start), toDate(end)),
      )
      .replace(PHRASE_DATE_PATTERN, (date) => format.format(toDate(date)));
  }

  private toGendered(text: GenderedText, gender: Gender) {
    return typeof text === 'string' ? text : text[gender];
  }

  private isSummaryPhrase(phrase: ReportPhrase): phrase is SummaryPhrase {
    return (PHRASE_SUMMARIES as readonly ReportPhrase[]).includes(phrase);
  }

  private toReference(locale: Locale, line: ActivityLine) {
    if (line.issue) {
      return `${PHRASE_ISSUE_PREFIX}${line.issue.iid}`;
    }
    const mergeRequest = line.mergeRequests.at(0);
    if (mergeRequest) {
      return `${PHRASE_MERGE_REQUEST_PREFIX}${mergeRequest.iid}`;
    }
    const title = this.toTitle(line);
    return title ? locale.phrases.quote(title) : '';
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
