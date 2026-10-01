import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import { AI_MODELS } from './ai-models';

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', AI_MODELS.embedding) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

// Mean-pooled, L2-normalized sentence embedding — standard usage for
// all-MiniLM-L6-v2, so cosine similarity reduces to a plain dot product.
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const text of texts) out.push(await embedText(text));
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both vectors are already L2-normalized
}
