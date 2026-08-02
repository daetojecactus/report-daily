export interface AiProvider {
  readonly name: string;
  generate(prompt: string, systemPrompt?: string): Promise<string>;
}

//источник генерации у конкретного вендора (репозиторий вендора)
export interface AiGenerator {
  generate(prompt: string, systemPrompt?: string): Promise<string>;
}

//общая обвязка вендора: между провайдерами отличаются только имя и репозиторий
export abstract class BaseAiProvider implements AiProvider {
  abstract readonly name: string;

  protected constructor(private readonly generator: AiGenerator) {}

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const text = await this.generator.generate(prompt, systemPrompt);
    return text.trim();
  }
}
