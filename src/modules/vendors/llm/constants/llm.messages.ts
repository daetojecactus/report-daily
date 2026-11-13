export enum LlmMessages {
  DISABLED = 'LLM is not configured',
  FORMAT_STEPPED_DOWN = 'LLM response format stepped down',
  INVALID_ANSWER = 'LLM answer does not match the schema',
  CUT_ANSWER = 'LLM answer was cut at the token limit',
  REFUSED = 'LLM refused to answer',
}
