import Anthropic, { APIError as AnthropicApiError } from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { LlmApi } from 'src/modules/infrastructure/config/types/config.enums';
import { LLM_ANTHROPIC_THINKING_TOKENS } from '../constants/llm.constants';
import { LlmMessages } from '../constants/llm.messages';
import { LlmAnthropicRepository } from '../llm-anthropic.repository';
import { LlmClient } from '../llm.client';
import { LlmFormat } from '../types/llm.enums';
import { LlmError } from '../llm.error';
import { LlmOpenAiRepository } from '../llm-openai.repository';
import { LlmService } from '../llm.service';

const SCHEMA = z.object({ lines: z.array(z.object({ id: z.string(), text: z.string() })) });
const PROMPT = { system: 'Answer in JSON.', user: 'Lines: [1] Fixed a bug' };
const ANSWER = '{"lines":[{"id":"1","text":"Fixed the login bug"}]}';
const DATA = { lines: [{ id: '1', text: 'Fixed the login bug' }] };
const CUT_ANSWER = '{"lines":[{"id":"1","te';

interface Reply {
  status: number;
  body?: unknown;
}

function completion(content: string, finishReason = 'stop') {
  return {
    status: 200,
    body: {
      id: 'completion-1',
      object: 'chat.completion',
      created: 0,
      model: 'served-model',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: finishReason }],
      usage: { prompt_tokens: 30, completion_tokens: 12, total_tokens: 42 },
    },
  };
}

function message(text: string | null, stopReason = 'end_turn') {
  return {
    status: 200,
    body: {
      id: 'message-1',
      type: 'message',
      role: 'assistant',
      model: 'served-claude',
      content: [
        { type: 'thinking', thinking: '', signature: 'signature' },
        ...(text === null ? [] : [{ type: 'text', text, citations: null }]),
      ],
      stop_reason: stopReason,
      stop_sequence: null,
      stop_details: null,
      container: null,
      usage: {
        input_tokens: 700,
        output_tokens: 60,
        output_tokens_details: { thinking_tokens: 20 },
        cache_creation: null,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        inference_geo: null,
        server_tool_use: null,
        service_tier: 'standard',
        speed: null,
      },
    },
  };
}

function createService(api: LlmApi, replies: Reply[]) {
  const bodies: Record<string, unknown>[] = [];
  const fetch = vi.fn((_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(init?.body as string) as Record<string, unknown>);
    const { status, body } = replies.shift() ?? { status: 500 };
    return Promise.resolve(
      new Response(JSON.stringify(body ?? { error: { type: 'error', message: 'no' } }), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  const options = { baseURL: 'http://llm.test', apiKey: 'test', maxRetries: 0, fetch };
  const openAi = api === LlmApi.OPENAI ? new OpenAI(options) : null;
  const anthropic = api === LlmApi.ANTHROPIC ? new Anthropic(options) : null;
  const client: LlmClient = { api, model: 'test-model', openAi, anthropic, isEnabled: () => true };
  const service = new LlmService(
    new LlmOpenAiRepository(client),
    new LlmAnthropicRepository(client),
    client,
  );
  const ask = () =>
    service.completeJson({ prompt: PROMPT, name: 'report_lines', schema: SCHEMA, maxTokens: 250 });
  return { ask, bodies };
}

function createClient(values: Record<string, string>) {
  return new LlmClient({
    get: (key: string) => values[key],
  } as unknown as ConfigService<AppEnvs, true>);
}

describe('LlmService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  describe('with an OpenAI-compatible API', () => {
    it('asks for the JSON schema within the answer budget and returns the checked answer', async () => {
      const { ask, bodies } = createService(LlmApi.OPENAI, [completion(ANSWER)]);

      expect(await ask()).toEqual({
        data: DATA,
        model: 'served-model',
        format: LlmFormat.JSON_SCHEMA,
        usage: { inputTokens: 30, outputTokens: 12, thinkingTokens: null },
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
      const { ask, bodies } = createService(LlmApi.OPENAI, [
        { status: 400 },
        { status: 422 },
        completion(`Here you are:\n${ANSWER}\nDone.`),
        completion(ANSWER),
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
      const { ask } = createService(LlmApi.OPENAI, [
        { status: 400 },
        { status: 400 },
        { status: 400 },
      ]);

      await expect(ask()).rejects.toBeInstanceOf(APIError);
    });

    it('does not step down on a server or an access error', async () => {
      const { ask, bodies } = createService(LlmApi.OPENAI, [
        { status: 500 },
        { status: 401 },
        completion(ANSWER),
      ]);

      await expect(ask()).rejects.toBeInstanceOf(APIError);
      await expect(ask()).rejects.toBeInstanceOf(APIError);
      expect((await ask()).format).toBe(LlmFormat.JSON_SCHEMA);
      expect(bodies).toHaveLength(3);
    });

    it.each(['not json', '{"lines": "none"}', '{"lines": [ {"id": 1'])(
      'refuses the answer %s',
      async (content) => {
        const { ask } = createService(LlmApi.OPENAI, [completion(content)]);

        await expect(ask()).rejects.toThrow(new LlmError(LlmMessages.INVALID_ANSWER));
      },
    );

    it('says the answer was cut at the token limit, and keeps a whole answer before the cut', async () => {
      const { ask } = createService(LlmApi.OPENAI, [
        completion(CUT_ANSWER, 'length'),
        completion(`${ANSWER} and then`, 'length'),
      ]);

      await expect(ask()).rejects.toThrow(new LlmError(LlmMessages.CUT_ANSWER));
      expect((await ask()).data).toEqual(DATA);
    });
  });

  describe('with the Claude API', () => {
    it('asks for the JSON schema at low effort with room to think and reads the text past the thinking', async () => {
      const { ask, bodies } = createService(LlmApi.ANTHROPIC, [message(ANSWER)]);

      expect(await ask()).toEqual({
        data: DATA,
        model: 'served-claude',
        format: LlmFormat.JSON_SCHEMA,
        usage: { inputTokens: 700, outputTokens: 60, thinkingTokens: 20 },
      });
      expect(bodies).toEqual([
        {
          model: 'test-model',
          max_tokens: 250 + LLM_ANTHROPIC_THINKING_TOKENS,
          system: PROMPT.system,
          messages: [{ role: 'user', content: PROMPT.user }],
          output_config: {
            effort: 'low',
            format: {
              type: 'json_schema',
              schema: expect.objectContaining({
                type: 'object',
                required: ['lines'],
                additionalProperties: false,
              }) as unknown,
            },
          },
        },
      ]);
      expect(bodies[0]).not.toHaveProperty('temperature');
      expect(bodies[0]).not.toHaveProperty('output_config.format.schema.$schema');
    });

    it('asks without the format when the schema is rejected and keeps asking so', async () => {
      const { ask, bodies } = createService(LlmApi.ANTHROPIC, [
        { status: 400 },
        message(`Here you are:\n${ANSWER}`),
        message(ANSWER),
      ]);

      expect((await ask()).format).toBe(LlmFormat.JSON_OBJECT);
      expect((await ask()).data).toEqual(DATA);
      expect(bodies.map((body) => body.output_config)).toEqual([
        expect.objectContaining({ format: expect.anything() as unknown }),
        { effort: 'low' },
        { effort: 'low' },
      ]);
    });

    it('turns a refusal into an error without stepping the format down', async () => {
      const { ask, bodies } = createService(LlmApi.ANTHROPIC, [
        message(null, 'refusal'),
        message(ANSWER),
      ]);

      await expect(ask()).rejects.toThrow(new LlmError(LlmMessages.REFUSED));
      expect((await ask()).format).toBe(LlmFormat.JSON_SCHEMA);
      expect(bodies).toHaveLength(2);
    });

    it('says the answer was cut at the token limit', async () => {
      const { ask } = createService(LlmApi.ANTHROPIC, [message(CUT_ANSWER, 'max_tokens')]);

      await expect(ask()).rejects.toThrow(new LlmError(LlmMessages.CUT_ANSWER));
    });

    it('does not step down on an access error', async () => {
      const { ask } = createService(LlmApi.ANTHROPIC, [{ status: 401 }]);

      await expect(ask()).rejects.toBeInstanceOf(AnthropicApiError);
    });
  });

  describe('client', () => {
    const LLM = { LLM_BASE_URL: 'http://llm.test', LLM_TOKEN: 'token', LLM_MODEL: 'model' };

    it('builds the client of the chosen API', () => {
      const openAi = createClient({ ...LLM, LLM_API: LlmApi.OPENAI });
      const anthropic = createClient({ ...LLM, LLM_API: LlmApi.ANTHROPIC });

      expect(openAi.openAi).toBeInstanceOf(OpenAI);
      expect(openAi.anthropic).toBeNull();
      expect(anthropic.anthropic).toBeInstanceOf(Anthropic);
      expect(anthropic.openAi).toBeNull();
      expect(openAi.isEnabled() && anthropic.isEnabled()).toBe(true);
    });

    it('is off without the three variables', async () => {
      const client = createClient({
        LLM_API: LlmApi.ANTHROPIC,
        LLM_BASE_URL: 'http://llm.test',
        LLM_MODEL: 'model',
      });
      const service = new LlmService(
        new LlmOpenAiRepository(client),
        new LlmAnthropicRepository(client),
        client,
      );

      expect(service.isEnabled()).toBe(false);
      await expect(
        service.completeJson({
          prompt: PROMPT,
          name: 'report_lines',
          schema: SCHEMA,
          maxTokens: 250,
        }),
      ).rejects.toThrow(LlmMessages.DISABLED);
    });
  });
});
