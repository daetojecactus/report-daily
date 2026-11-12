import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { LlmClient } from '../llm.client';
import { LlmFormat } from '../types/llm.enums';
import { LlmError } from '../llm.error';
import { LlmRepository } from '../llm.repository';
import { LlmService } from '../llm.service';

const SCHEMA = z.object({ lines: z.array(z.object({ id: z.string(), text: z.string() })) });
const PROMPT = { system: 'Answer in JSON.', user: 'Lines: [1] Fixed a bug' };
const ANSWER = '{"lines":[{"id":"1","text":"Fixed the login bug"}]}';

interface Reply {
  status: number;
  content?: string;
}

function completion(content: string) {
  return {
    id: 'completion-1',
    object: 'chat.completion',
    created: 0,
    model: 'served-model',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 30, completion_tokens: 12, total_tokens: 42 },
  };
}

function createService(replies: Reply[]) {
  const bodies: Record<string, unknown>[] = [];
  const fetch = vi.fn((_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(init?.body as string) as Record<string, unknown>);
    const reply = replies.shift() ?? { status: 500 };
    const body =
      reply.status === 200 ? completion(reply.content ?? '') : { error: { message: 'no' } };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: reply.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  const client = {
    instance: new OpenAI({ baseURL: 'http://llm.test/v1', apiKey: 'test', maxRetries: 0, fetch }),
    model: 'test-model',
  } as LlmClient;
  const service = new LlmService(new LlmRepository(client), client);
  const ask = () =>
    service.completeJson({ prompt: PROMPT, name: 'report_lines', schema: SCHEMA, maxTokens: 250 });
  return { service, ask, bodies };
}

describe('LlmService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  it('asks for the JSON schema within the answer budget and returns the checked answer', async () => {
    const { ask, bodies } = createService([{ status: 200, content: ANSWER }]);

    expect(await ask()).toEqual({
      data: { lines: [{ id: '1', text: 'Fixed the login bug' }] },
      model: 'served-model',
      format: LlmFormat.JSON_SCHEMA,
      outputTokens: 12,
    });
    expect(bodies).toEqual([
      {
        model: 'test-model',
        temperature: 0.2,
        max_tokens: 250,
        messages: [
          { role: 'system', content: PROMPT.system },
          { role: 'user', content: PROMPT.user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'report_lines', schema: z.toJSONSchema(SCHEMA) },
        },
      },
    ]);
  });

  it('steps down to a JSON object and then to text and keeps the mode that works', async () => {
    const { ask, bodies } = createService([
      { status: 400 },
      { status: 422 },
      { status: 200, content: `Here you are:\n${ANSWER}\nDone.` },
      { status: 200, content: ANSWER },
    ]);

    expect((await ask()).format).toBe(LlmFormat.TEXT);
    expect((await ask()).data.lines).toHaveLength(1);
    expect(bodies.map((body) => body.response_format)).toEqual([
      expect.objectContaining({ type: 'json_schema' }),
      { type: 'json_object' },
      undefined,
      undefined,
    ]);
  });

  it('gives up when even text is refused', async () => {
    const { ask } = createService([{ status: 400 }, { status: 400 }, { status: 400 }]);

    await expect(ask()).rejects.toBeInstanceOf(APIError);
  });

  it('does not step down on a server or an access error', async () => {
    const { ask, bodies } = createService([
      { status: 500 },
      { status: 401 },
      { status: 200, content: ANSWER },
    ]);

    await expect(ask()).rejects.toBeInstanceOf(APIError);
    await expect(ask()).rejects.toBeInstanceOf(APIError);
    expect((await ask()).format).toBe(LlmFormat.JSON_SCHEMA);
    expect(bodies).toHaveLength(3);
  });

  it.each(['not json', '{"lines": "none"}', '{"lines": [ {"id": 1'])(
    'refuses the answer %s',
    async (content) => {
      const { ask } = createService([{ status: 200, content }]);

      await expect(ask()).rejects.toBeInstanceOf(LlmError);
    },
  );

  it('is off without the three variables', async () => {
    const values: Record<string, string> = { LLM_BASE_URL: 'http://llm.test/v1', LLM_MODEL: 'm' };
    const client = new LlmClient({
      get: (key: string) => values[key],
    } as unknown as ConfigService<AppEnvs, true>);
    const service = new LlmService(new LlmRepository(client), client);

    expect(service.isEnabled()).toBe(false);
    await expect(
      service.completeJson({
        prompt: PROMPT,
        name: 'report_lines',
        schema: SCHEMA,
        maxTokens: 250,
      }),
    ).rejects.toThrow('LLM is not configured');
  });
});
