export type ContentAiProvider = 'deterministic' | 'ollama' | 'openai';

export type ContentAiConfig = {
  provider: ContentAiProvider;
  ollamaBaseUrl: string;
  ollamaModel: string;
};

export function getContentAiConfig(
  env: Record<string, string | undefined> = process.env,
): ContentAiConfig {
  const requested = (
    env.CONTENT_AI_PROVIDER ??
    env.CONTENT_SUMMARIZER ??
    'deterministic'
  ).toLowerCase();
  if (!['deterministic', 'ollama', 'openai'].includes(requested)) {
    throw new Error(`Unsupported CONTENT_AI_PROVIDER: ${requested}`);
  }
  return {
    provider: requested as ContentAiProvider,
    ollamaBaseUrl: env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
    ollamaModel: env.OLLAMA_MODEL ?? env.OLLAMA_CONTENT_MODEL ?? 'qwen3:4b-instruct',
  };
}

export function assertLocalOllamaUrl(value: string) {
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)) {
    throw new Error(
      'OLLAMA_BASE_URL must point to a local loopback address; Ollama Cloud is disabled.',
    );
  }
  return url.origin;
}
