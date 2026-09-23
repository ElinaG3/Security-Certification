// Single source of truth for which Claude model each AI call path uses.
// Change a model here, not per-script — every generation/grading script
// imports from this file instead of hardcoding a model string.
export const AI_MODELS = {
  // One-time/occasional batch content generation (card writing, rewrites,
  // explanation/mnemonic drafting, repair). Output quality directly affects
  // what the user learns, so this stays on Sonnet even though it costs more.
  content: 'claude-sonnet-5',

  // Per-review or per-session runtime calls (fill_in near-miss grading,
  // Phase 4 PDF/image text extraction). Not yet implemented — reserved here
  // so those paths start on Haiku from day one instead of defaulting to Sonnet.
  fast: 'claude-haiku-4-5-20251001',
} as const;
