# Down & Distance search

Search is grounded in Down & Distance records and does not call a proprietary AI API.

## Architecture

- PostgreSQL full-text search provides lexical retrieval.
- `pgvector` provides cosine-similarity retrieval over 384-dimensional embeddings.
- Reciprocal Rank Fusion (`k=60`) combines lexical and semantic ranks. Retrieved chunks are collapsed to their parent record before presentation.
- `BAAI/bge-small-en-v1.5` is served through an OpenAI-compatible self-hosted embedding endpoint (Infinity is a suitable CPU/GPU server). The provider is isolated in `src/server/search/providers.ts`.
- Basic search does not require embeddings. When the embedding service is unavailable, indexing and querying continue lexically.
- Grounded answers are optional and use an Ollama-compatible self-hosted `qwen2.5:3b-instruct`. The prompt restricts answers to retrieved records and emits source IDs. Failure returns normal results.
- Voice search sends an in-memory recording to a self-hosted Whisper-compatible endpoint (`faster-whisper` or `whisper.cpp`). D&D does not persist audio.

## Setup

1. Apply `db/migrations/017_search_documents.sql` to a PostgreSQL installation with pgvector available.
2. Start an OpenAI-compatible embedding server with `BAAI/bge-small-en-v1.5` on port 7997.
3. Optionally start Ollama with `qwen2.5:3b-instruct` and a Whisper-compatible transcription server with `small.en`.
4. Configure the variables documented in `.env.example`.
5. Run `npm run search:reindex` once, then use `npm run search:index` for incremental reconciliation.

The BGE model is roughly 130 MB. Whisper `small.en` is roughly 460 MB. Qwen 2.5 3B is typically 2–3 GB when quantized. CPU works for development; a GPU improves indexing, transcription, and answer latency. Production requires PostgreSQL/pgvector and the embedding service for semantic retrieval. Whisper and Ollama are optional.

## Indexing

The indexer reads canonical stories, their attributed source articles, and structured roster/player data. Long records are overlapping chunks. A SHA-256 content hash includes the source update time and normalized chunk content; unchanged chunks are skipped, while missing records are deactivated. Model files and microphone recordings are never committed or stored.

The daily `.github/workflows/search-index.yml` job follows the repository's existing scheduling approach. Configure repository secrets for `DATABASE_URL` and `SEARCH_EMBEDDING_BASE_URL`. The same command can run from VPS cron when model endpoints are private.

New content can call `indexDocument(sourceType, sourceId)` after persistence. The daily job remains the backstop. To add a content type, create a collector that maps it to `IndexDocument` and include it in `collectCanonicalContent`; retrieval and UI need no changes. To swap a model, implement the relevant `EmbeddingProvider`, `AnswerProvider`, or `SpeechToTextProvider` and inject it at the service boundary.
