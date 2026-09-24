// Single source of truth for which Claude model each AI call path uses.
// Change a model here, not per-script — every generation/grading script
// imports from this file instead of hardcoding a model string.
export const AI_MODELS = {
  // One-time/occasional batch content generation (card writing, rewrites,
  // explanation/mnemonic drafting, repair). Output quality directly affects
  // what the user learns, so this stays on Sonnet even though it costs more.
  content: 'claude-sonnet-5',

  // Per-review or per-session runtime calls (fill_in near-miss grading,
  // OCR/vision extraction for scanned or image-based PDFs). Not yet
  // implemented — reserved here so those paths start on Haiku from day one
  // instead of defaulting to Sonnet. Text-based PDFs (e.g. Messer's course
  // notes) don't need this at all — see AI_MODELS.embedding below.
  fast: 'claude-haiku-4-5-20251001',

  // Local embedding model (@xenova/transformers, runs on-device — no API
  // key, no per-call cost) used for chunk-to-objective mapping and
  // duplicate-coverage detection during PDF ingestion, instead of spending
  // a Claude call per chunk on classification. Swapping to a hosted model
  // (e.g. Voyage) later is one edit here — but EMBEDDING_DIMENSIONS must
  // also change to match, since it's baked into the pgvector column.
  embedding: 'Xenova/all-MiniLM-L6-v2',
} as const;

export const EMBEDDING_DIMENSIONS = 384;
