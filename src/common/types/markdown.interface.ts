export interface MarkdownMarks {
  text(text: string): string;
  code(code: string): string;
  bold(content: string): string;
  italic(content: string): string;
  link(content: string, url: string): string;
}
