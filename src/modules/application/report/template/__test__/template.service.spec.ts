import { describe, expect, it } from 'vitest';
import { SourceActionKind } from 'src/modules/application/source/types/source.enums';
import { at, createIssue, fact } from '../../activity/__test__/activity.fixture';
import { createGoldenIndex, loadGoldenDays } from '../../activity/__test__/activity.golden.fixture';
import type { TemplateRepository } from '../template.repository';
import { TemplateService } from '../template.service';
import { buildContext, createDay } from './template.fixture';

function commented(iid: number, title = `Issue ${iid}`, projectId = 1) {
  return createIssue({
    iid,
    projectId,
    title,
    facts: [fact(SourceActionKind.COMMENTED, at(10))],
  });
}

describe('TemplateService', () => {
  const service = new TemplateService({} as TemplateRepository);

  it('renders the standard template as projects with their lines', async () => {
    const context = buildContext(
      createDay({ issues: [commented(1), commented(2), commented(3, 'Issue 3', 2)] }),
    );

    expect(await service.renderStandard(context)).toBe(
      [
        'project-1:',
        '• Прокомментировал «Issue 1»',
        '• Прокомментировал «Issue 2»',
        '',
        'project-2:',
        '• Прокомментировал «Issue 3»',
      ].join('\n'),
    );
    expect(await service.renderStandard(buildContext(createDay()))).toBe('');
  });

  it('escapes the data for Markdown and keeps the markup of the template', async () => {
    const context = buildContext(createDay({ issues: [commented(1, 'Fix *bold* _it_ [x]')] }));

    expect(await service.renderStandard(context)).toBe(
      'project-1:\n• Прокомментировал «Fix \\*bold\\* \\_it\\_ \\[x\\]»',
    );
    expect(
      await service.render(
        '{% for item in context.items %}**[{{ item.title }}]({{ item.url | raw }})**{% endfor %}',
        context,
      ),
    ).toBe(
      '**[Fix \\*bold\\* \\_it\\_ \\[x\\]](https://gitlab.example.com/group/project-1/-/issues/12)**',
    );
  });

  it('tells a syntax error of a template before it is saved', () => {
    expect(service.check('{% for item in context.items %}{{ item.text }}{% endfor %}')).toBeNull();
    expect(service.check('{% for item in context.items %}{{ item.text }}')).toContain('not closed');
    expect(service.check('{{ item.text ')).not.toBeNull();
  });

  it('reads no files, no prototypes and stops at the limits', async () => {
    const context = buildContext(createDay());

    await expect(service.render("{% include 'package.json' %}", context)).rejects.toThrow();
    await expect(service.render("{% render 'package.json' %}", context)).rejects.toThrow();
    expect(await service.render('{{ context.constructor }}{{ context.items.size }}', context)).toBe(
      '0',
    );
    await expect(
      service.render('{% for i in (1..100000000) %}{{ i }}{% endfor %}', context),
    ).rejects.toThrow();
    await expect(service.render('{{ context.date | missing }}', context)).rejects.toThrow();
  });

  it('turns every golden day into lines under their projects', async () => {
    for (const golden of loadGoldenDays()) {
      const text = await service.renderStandard(
        buildContext(golden.day, {
          role: golden.role,
          username: golden.username,
          index: createGoldenIndex(),
        }),
      );
      const lines = text.split('\n');

      expect(
        lines.every((line) => line === '' || line.endsWith(':') || line.startsWith('• ')),
        golden.name,
      ).toBe(true);
      expect(lines.filter((line) => line.startsWith('• ')).length, golden.name).toBeGreaterThan(0);
    }
  });
});
