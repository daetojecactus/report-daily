import { Injectable } from '@nestjs/common';
import type { AiPolicy } from 'src/modules/application/ai/ai.interface';
import { AiService } from 'src/modules/application/ai/ai.service';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import type { User } from 'src/modules/application/user/user.interface';
import type { ActivityResult } from './activity/activity.interface';
import type { TemplateBuild, TemplateItem } from './template/template.interface';

@Injectable()
export class ReportRewriter {
  constructor(private readonly aiService: AiService) {}

  async rewrite({ context, sources }: TemplateBuild, user: User, locale: Locale, policy: AiPolicy) {
    const entries = [...sources].filter(
      (entry): entry is [TemplateItem & { title: string }, ActivityResult] =>
        entry[0].title !== null,
    );
    const { texts, model } = await this.aiService.reword(
      entries.map(([item, result], index) => ({
        id: String(index + 1),
        action: item.actionText,
        title: item.title,
        kind: item.kind,
        commits: policy.commits ? result.signals.pushes.flatMap((push) => push.commitTitles) : [],
        comments: policy.comments ? this.toComments(result) : [],
      })),
      { role: user.role, gender: user.gender, locale },
    );
    entries.forEach(([item], index) => {
      item.text = texts.get(String(index + 1)) ?? item.text;
    });
    context.ai.used = model !== null;
    return model;
  }

  private toComments({ line }: ActivityResult) {
    return [...(line.issue ? [line.issue] : []), ...line.mergeRequests]
      .flatMap(({ events }) => events)
      .flatMap(({ noteBody }) => (noteBody ? [noteBody] : []));
  }
}
