import { Injectable } from '@nestjs/common';
import type { AiNames } from 'src/modules/application/ai/types/ai.interface';
import { AiService } from 'src/modules/application/ai/ai.service';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import type { TraitIndex } from 'src/modules/application/trait/types/trait.interface';
import { TraitService } from 'src/modules/application/trait/trait.service';
import { ActivityAction } from './activity/types/activity.enums';
import type { ActivityFact, ActivityResult } from './activity/types/activity.interface';
import { REPORT_AI_NAME_DETAILS } from './constants/report.constants';
import type { ReportRewriting } from './types/report.interface';
import type { TemplateBuild, TemplateItem } from './template/types/template.interface';

@Injectable()
export class ReportRewriter {
  constructor(
    private readonly aiService: AiService,
    private readonly traitService: TraitService,
  ) {}

  async rewrite({ context, sources }: TemplateBuild, request: ReportRewriting) {
    const { user, locale, policy, index } = request;
    const entries = [...sources].filter(
      (entry): entry is [TemplateItem & { title: string }, ActivityResult] =>
        entry[0].title !== null,
    );
    const { texts, model } = await this.aiService.reword(
      entries.map(([item, result], position) => ({
        id: String(position + 1),
        action: item.actionText,
        title: item.title,
        kind: item.kind,
        commits: policy.commits ? result.signals.pushes.flatMap((push) => push.commitTitles) : [],
        comments: policy.comments ? this.toComments(result) : [],
        names: this.toNames(result, index),
      })),
      { role: user.role, gender: user.gender, locale },
    );
    entries.forEach(([item], position) => {
      item.text = texts.get(String(position + 1)) ?? item.text;
    });
    context.ai.used = model !== null;
    return model;
  }

  private toComments({ line }: ActivityResult) {
    return [...(line.issue ? [line.issue] : []), ...line.mergeRequests]
      .flatMap(({ events }) => events)
      .flatMap(({ noteBody }) => (noteBody ? [noteBody] : []));
  }

  private toNames({ choice: { main } }: ActivityResult, index: TraitIndex): AiNames | null {
    if (
      main.action !== ActivityAction.EDITED ||
      !main.details.some((detail) => REPORT_AI_NAME_DETAILS.includes(detail))
    ) {
      return null;
    }
    const unknown = main.facts.filter(
      (fact): fact is ActivityFact & { value: string } =>
        fact.value !== null && this.traitService.findTraits(index, fact.value).length === 0,
    );
    if (!unknown.length) {
      return null;
    }
    const names = (removed: boolean) => [
      ...new Set(
        unknown
          .filter((fact) => (fact.kind === SourceActionKind.LABEL_REMOVED) === removed)
          .map((fact) => fact.value),
      ),
    ];
    return { added: names(false), removed: names(true) };
  }
}
