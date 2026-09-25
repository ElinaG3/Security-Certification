'use server';

import { getDb } from '@/db';
import { cards } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { checkCardConsistency } from '@/lib/card-consistency';
import { generateCardDraft, type GeneratedCardDraft, type DraftRequest } from '@/lib/card-generation';

export async function generateDraft(req: DraftRequest): Promise<GeneratedCardDraft> {
  return generateCardDraft(req);
}

export interface SaveCardInput {
  domain: string;
  objective: string | null;
  topic: string;
  type: 'multiple_choice' | 'multiple_select';
  question: string;
  options: string[];
  correct: number[]; // one entry for multiple_choice, requiredCount entries for multiple_select
  requiredCount?: number;
  explanation: string;
  distractorExplanations: string[];
  authoredDifficulty: 'application' | 'analysis';
}

export type SaveCardResult = { ok: true; id: string } | { ok: false; issues: string[] };

export async function saveCard(input: SaveCardInput): Promise<SaveCardResult> {
  const content =
    input.type === 'multiple_select'
      ? {
          question: input.question,
          options: input.options,
          correct: input.correct,
          requiredCount: input.requiredCount ?? input.correct.length,
          explanation: input.explanation,
          distractorExplanations: input.distractorExplanations,
        }
      : {
          question: input.question,
          options: input.options,
          correct: input.correct[0],
          explanation: input.explanation,
          distractorExplanations: input.distractorExplanations,
        };

  const issues = checkCardConsistency(content as any, input.type);
  if (input.options.length !== 4) issues.push(`expected exactly 4 options, got ${input.options.length}`);
  if (input.topic.trim() === '') issues.push('topic is required');
  if (input.question.trim() === '') issues.push('question is required');
  if (input.correct.length === 0) issues.push('at least one option must be marked correct');

  if (issues.length > 0) return { ok: false, issues };

  const db = getDb();
  const user = await getCurrentUser();

  const [inserted] = await db
    .insert(cards)
    .values({
      userId: user.id,
      domain: input.domain,
      topic: input.topic,
      type: input.type,
      content,
      status: 'active',
      sourceType: 'manual',
      authoredDifficulty: input.authoredDifficulty,
      objective: input.objective,
    })
    .returning();

  return { ok: true, id: inserted.id };
}
