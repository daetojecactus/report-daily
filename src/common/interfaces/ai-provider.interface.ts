export interface AiProvider {
  readonly name: string;
  generate(prompt: string, systemPrompt?: string): Promise<string>;
}
