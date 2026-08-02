import { ReportTemplateService } from './report-template.service';
import type { ProjectReport, ReportLine } from '../report.interface';
import { TaskStatus, TaskType } from 'src/common/enums/task.enum';
import { ReportTemplate } from '../../user/user.enums';
import { Language } from 'src/common/i18n/i18n';

function buildLine(
  status: TaskStatus,
  description: string,
  priority: string | null = null,
): ReportLine {
  return {
    title: description,
    status,
    taskType: TaskType.UNKNOWN,
    description,
    webUrl: null,
    priority,
  };
}

function buildProject(name: string, lines: ReportLine[]): ProjectReport {
  return { projectName: name, lines };
}

describe('ReportTemplateService — QA-шаблон', () => {
  let service: ReportTemplateService;

  beforeEach(() => {
    service = new ReportTemplateService();
  });

  function formatQa(projects: ProjectReport[]): string {
    return service.formatText(projects, ReportTemplate.QA, Language.RU);
  }

  it('раскладывает QA-активности по секциям в заданном порядке', () => {
    const text = formatQa([
      buildProject('account', [
        buildLine(
          TaskStatus.QA_AUTOMATION_DEVELOPED,
          'Добавил pages и компоненты',
        ),
        buildLine(TaskStatus.FOUND_BUG, 'Баг с регионами'),
        buildLine(
          TaskStatus.TESTED_AND_APPROVED,
          'Протестировал определение языка',
        ),
        buildLine(
          TaskStatus.QA_IN_PROGRESS,
          'Проверял начисление вознаграждения',
        ),
        buildLine(TaskStatus.QA_RETURNED_TO_DEV, 'Вернул задачу на доработку'),
      ]),
    ]);

    const sections = text
      .split('\n')
      .filter((line) =>
        [
          'Возвраты в разработку',
          'Тестирование',
          'MR / задачи проверены',
          'Баги',
          'Автотесты / POM / покрытие',
        ].includes(line),
      );

    expect(sections).toEqual([
      'Возвраты в разработку',
      'Тестирование',
      'MR / задачи проверены',
      'Баги',
      'Автотесты / POM / покрытие',
    ]);
  });

  it('не выводит пустые секции', () => {
    const text = formatQa([
      buildProject('ssl', [
        buildLine(TaskStatus.QA_E2E_COVERAGE_ADDED, 'Дописал админские тесты'),
      ]),
    ]);

    expect(text).toContain('Автотесты / POM / покрытие');
    expect(text).not.toContain('Возвраты в разработку');
    expect(text).not.toContain('Баги');
  });

  it('форматирует строку как [PROJECT] - PRIORITY с описанием', () => {
    const text = formatQa([
      buildProject('dbaas2', [
        buildLine(
          TaskStatus.QA_RETURNED_TO_DEV,
          'Вернул задачу на доработку: мерцание заголовков',
          'HIGH',
        ),
      ]),
    ]);

    expect(text).toContain(
      '[DBAAS2] - HIGH\nВернул задачу на доработку: мерцание заголовков',
    );
  });

  it('статусы вне известных секций уходят в «Прочее»', () => {
    const text = formatQa([
      buildProject('qa', [
        buildLine(TaskStatus.PASSED_TO_FRONTEND, 'Передал на фронтенд'),
      ]),
    ]);

    expect(text).toContain('Прочее');
  });

  it('каждая задача попадает ровно в одну секцию', () => {
    const text = formatQa([
      buildProject('storage', [
        buildLine(TaskStatus.QA_IN_PROGRESS, 'Провёл регресс по бакетам'),
      ]),
    ]);

    const occurrences = text.split('Провёл регресс по бакетам').length - 1;
    expect(occurrences).toBe(1);
  });
});
