export interface EmbeddingProvider {
  readonly dimensions: number;
  embedDocument(text: string): Promise<number[]>;
  embedQuery(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface AnswerProvider {
  answer(
    query: string,
    context: Array<{ id: string; title: string; content: string }>,
  ): Promise<string>;
}

export interface SpeechToTextProvider {
  transcribe(audio: Blob, filename: string): Promise<string>;
}

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 15_000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export class BgeHttpEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 384;
  private readonly baseUrl = process.env.SEARCH_EMBEDDING_BASE_URL ?? 'http://127.0.0.1:7997';
  private readonly model = process.env.SEARCH_EMBEDDING_MODEL ?? 'BAAI/bge-small-en-v1.5';

  private async embed(texts: string[]) {
    const response = await fetchWithTimeout(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!response.ok) throw new Error(`Embedding service returned ${response.status}`);
    const payload = (await response.json()) as {
      data?: Array<{ embedding: number[]; index: number }>;
    };
    const rows = [...(payload.data ?? [])].sort((a, b) => a.index - b.index);
    if (rows.length !== texts.length) throw new Error('Embedding service returned incomplete data');
    return rows.map((row) => row.embedding);
  }

  embedDocument(text: string) {
    return this.embed([`Represent this NFL document for retrieval: ${text}`]).then(
      ([value]) => value,
    );
  }
  embedQuery(text: string) {
    return this.embed([
      `Represent this NFL question for retrieving relevant documents: ${text}`,
    ]).then(([value]) => value);
  }
  embedBatch(texts: string[]) {
    return this.embed(texts.map((text) => `Represent this NFL document for retrieval: ${text}`));
  }
}

export class OllamaAnswerProvider implements AnswerProvider {
  private readonly baseUrl = process.env.SEARCH_LLM_BASE_URL ?? 'http://127.0.0.1:11434';
  private readonly model = process.env.SEARCH_LLM_MODEL ?? 'qwen2.5:3b-instruct';

  async answer(query: string, context: Array<{ id: string; title: string; content: string }>) {
    const prompt = `Answer only from the supplied Down & Distance records. Distinguish facts from opinion. Never invent scores, injuries, player status, or betting lines. If the records do not answer the question, say so. Cite supporting records as [source:id].\n\nQuestion: ${query}\n\nRecords:\n${context.map((item) => `[source:${item.id}] ${item.title}\n${item.content}`).join('\n\n')}`;
    const response = await fetchWithTimeout(
      `${this.baseUrl}/api/generate`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt, stream: false }),
      },
      30_000,
    );
    if (!response.ok) throw new Error(`Answer service returned ${response.status}`);
    const payload = (await response.json()) as { response?: string };
    if (!payload.response?.trim()) throw new Error('Answer service returned no answer');
    return payload.response.trim();
  }
}

export class WhisperHttpProvider implements SpeechToTextProvider {
  private readonly baseUrl = process.env.WHISPER_BASE_URL ?? 'http://127.0.0.1:8000';
  private readonly model = process.env.WHISPER_MODEL ?? 'small.en';

  async transcribe(audio: Blob, filename: string) {
    const form = new FormData();
    form.set('file', audio, filename);
    form.set('model', this.model);
    const response = await fetchWithTimeout(
      `${this.baseUrl}/v1/audio/transcriptions`,
      {
        method: 'POST',
        body: form,
      },
      45_000,
    );
    if (!response.ok) throw new Error(`Transcription service returned ${response.status}`);
    const payload = (await response.json()) as { text?: string };
    if (!payload.text?.trim()) throw new Error('No speech detected');
    return payload.text.trim();
  }
}
