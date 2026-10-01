// Multi-certification refactor, Stage 1. A fixed, well-known id for the
// SY0-701 certification row — deliberately hardcoded rather than looked up,
// so existing insert call sites (cards, ingested_chunks, recall_attempts)
// can keep working unchanged: the certification_id column on those tables
// carries this exact value as its DB-level DEFAULT, so nothing in
// application code needs to change for Stage 1 to be additive-only.
//
// Stage 2+ removes the default and routes every read/write through real
// "active certification" selection — this constant is the seam that gets
// replaced then, not a permanent architectural feature.
export const SY0_701_CERTIFICATION_ID = '11111111-1111-1111-1111-111111111111';
