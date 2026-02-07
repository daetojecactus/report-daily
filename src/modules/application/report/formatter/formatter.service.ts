import { Injectable } from '@nestjs/common';
import { ReportMessage, TASK_STATUS_VERB } from '../constants/report.messages';
import { DailyReport, TaskGroup } from '../report.types';
import { TaskStatus } from '../../../../common/enums/task.enum';

@Injectable()
export class FormatterService {
  formatConsole(report: DailyReport): string {
    if (report.projects.length === 0) {
      return ReportMessage.NO_EVENTS;
    }

    const lines: string[] = [];
    const dateStr = report.date.toLocaleDateString('ru-RU');
    lines.push(ReportMessage.CONSOLE_HEADER(dateStr));

    for (const project of report.projects) {
      const taskLines = project.tasks
        .map((t) => this.formatTask(t))
        .filter(Boolean)
        .map((t) => `• ${t}`);

      if (taskLines.length === 0) continue;

      lines.push(`${project.projectName}:`);
      lines.push(taskLines.join('\n'));
      lines.push('');
    }

    return lines.join('\n');
  }

  formatTelegram(report: DailyReport): string {
    if (report.projects.length === 0) {
      return ReportMessage.NO_EVENTS;
    }

    const dateStr = report.date.toLocaleDateString('ru-RU');
    const header = `<b>${ReportMessage.REPORT_HEADER(dateStr)}</b>\n`;

    const projectLines: string[] = [];
    for (const project of report.projects) {
      const taskLines = project.tasks
        .map((t) => this.formatTask(t))
        .filter(Boolean)
        .map((t) => `• ${t}`);

      if (taskLines.length === 0) continue;

      projectLines.push(`${project.projectName}:`);
      projectLines.push(taskLines.join('\n'));
      projectLines.push('');
    }

    const body = projectLines.join('\n').trim();
    if (!body) return ReportMessage.NO_EVENTS;

    return `${header}\n<pre>${body}</pre>`;
  }

  private formatTask(task: TaskGroup): string {
    if (task.taskId === 0) return '';
    if (task.aiDescription) return task.aiDescription;

    const verb =
      TASK_STATUS_VERB[task.status] || TASK_STATUS_VERB[TaskStatus.UNKNOWN];
    return `${verb} «${task.taskTitle}»`;
  }
}
