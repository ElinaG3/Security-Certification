// Audits every active multiple_select card for a specific quality problem
// the structural consistency check can't catch: distractors that are
// GENERICALLY weak (eliminable without reading the scenario at all)
// rather than CONTEXTUALLY wrong (a real, legitimate control that's wrong
// only because of a detail in this specific scenario). Real CompTIA
// "Choose two/three" questions make all four options plausible; if a
// wrong option is obviously silly or unrelated, the question is easier
// than it should be.
//
// This is read-only — it never rejects, regenerates, or modifies
// anything. It prints every flagged card so a human can decide whether to
// reject or regenerate it.
//
// Usage: npx dotenv-cli -e .env -- tsx scripts/audit-multiselect-distractors.ts

import { writeFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import { AI_MODELS } from '../src/lib/ai-models';
import type { MultipleSelectContent } from '../src/db/question-types';

const MODEL = AI_MODELS.content;
const BATCH_SIZE = 6;

const client = new Anthropic();

type Card = typeof cards.$inferSelect;

const JudgmentSchema = z.object({
  optionIndex: z.number(),
  verdict: z.enum(['contextually_wrong', 'generically_weak']),
  reason: z.string(),
});
const CardAuditSchema = z.object({
  cardIndex: z.number(),
  wrongOptionJudgments: z.array(JudgmentSchema),
});
const BatchResultSchema = z.object({ cards: z.array(CardAuditSchema) });
type CardAudit = z.infer<typeof CardAuditSchema>;

const submitAuditTool: Anthropic.Tool = {
  name: 'submit_audit',
  description: 'Submit distractor-quality judgments for a batch of multiple_select practice questions.',
  input_schema: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            cardIndex: { type: 'integer', description: 'The index number given for this card in the prompt' },
            wrongOptionJudgments: {
              type: 'array',
              description: 'One entry per WRONG (non-correct) option on this card',
              items: {
                type: 'object',
                properties: {
                  optionIndex: { type: 'integer' },
                  verdict: { type: 'string', enum: ['contextually_wrong', 'generically_weak'] },
                  reason: { type: 'string', description: 'One sentence justifying the verdict' },
                },
                required: ['optionIndex', 'verdict', 'reason'],
              },
            },
          },
          required: ['cardIndex', 'wrongOptionJudgments'],
        },
      },
    },
    required: ['cards'],
  },
};

function buildPrompt(batch: Card[]): string {
  const spec = batch
    .map((card, i) => {
      const content = card.content as MultipleSelectContent;
      const optionLines = content.options.map((opt, idx) => {
        const marker = content.correct.includes(idx) ? '(correct)' : '(wrong)';
        return `    ${idx} ${marker}: ${opt}`;
      });
      return [`${i}. [${card.domain} / ${card.topic}]`, `   Q: ${content.question}`, ...optionLines].join('\n');
    })
    .join('\n\n');

  return `You are auditing existing CompTIA Security+ SY0-701 "Choose N" (multiple_select) practice questions for one specific quality problem.

Real CompTIA multi-select questions make ALL FOUR options plausible, legitimate security controls. The wrong options are wrong only because of a specific detail in the scenario (wrong layer, wrong phase, wrong scope, wrong cost tier, solves a different risk) — never because they're generic, unrelated to the topic, or nonsensical.

For each card below, judge ONLY its (wrong) options. For each one, decide:
- "contextually_wrong": a real, legitimate control that fits the general topic area and could be a fine answer in a DIFFERENT scenario — wrong here specifically because of something stated in this scenario.
- "generically_weak": eliminable without needing to understand the scenario at all — it doesn't fit the topic, is vague or nonsensical, or is such an obviously worse choice that it isn't functioning as a real distractor.

Be a strict, skeptical grader — the goal is to find weak questions, not to be generous. Give a one-sentence reason for every judgment, citing what specifically makes it contextual or generic.

Cards:
${spec}

Call submit_audit with one entry per card (matching cardIndex to the numbers above), covering every (wrong) option.`;
}

async function auditBatch(batch: Card[]): Promise<(CardAudit | null)[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    tools: [submitAuditTool],
    tool_choice: { type: 'tool', name: 'submit_audit' },
    messages: [{ role: 'user', content: buildPrompt(batch) }],
  });

  const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in response');

  const rawCardsField = (toolUse.input as { cards?: unknown })?.cards;
  const rawCards = Array.isArray(rawCardsField) ? rawCardsField : [];

  const byIndex = new Map<number, unknown>();
  for (const raw of rawCards) {
    if (raw && typeof raw === 'object' && 'cardIndex' in raw) byIndex.set((raw as { cardIndex: number }).cardIndex, raw);
  }

  return batch.map((_, i) => {
    const raw = byIndex.get(i);
    if (raw === undefined) {
      console.log(`  AUDIT PARSE FAILURE: no judgment returned for card ${i}`);
      return null;
    }
    const parsed = CardAuditSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    console.log(`  AUDIT PARSE FAILURE for card ${i}: ${parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ')}`);
    return null;
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function formatFlaggedCard(card: Card, audit: CardAudit): string {
  const content = card.content as MultipleSelectContent;
  const lines: string[] = [];
  lines.push(`\n=== [${card.domain} / ${card.topic}] (${card.sourceType ?? 'unknown source'}, id ${card.id}) ===`);
  lines.push(`Q: ${content.question}`);
  const judgmentByIndex = new Map(audit.wrongOptionJudgments.map((j) => [j.optionIndex, j]));
  content.options.forEach((opt, idx) => {
    if (content.correct.includes(idx)) {
      lines.push(`  ${idx} (correct): ${opt}`);
      return;
    }
    const j = judgmentByIndex.get(idx);
    if (!j) {
      lines.push(`  ${idx} (wrong, no judgment returned): ${opt}`);
      return;
    }
    const tag = j.verdict === 'generically_weak' ? '*** GENERICALLY WEAK ***' : 'contextually wrong (fine)';
    lines.push(`  ${idx} (wrong — ${tag}): ${opt}`);
    lines.push(`     -> ${j.reason}`);
  });
  return lines.join('\n');
}

async function main() {
  const db = getDb();
  const active = await db.select().from(cards).where(eq(cards.status, 'active'));
  const multiSelect = active.filter((c) => c.type === 'multiple_select');
  console.log(`Auditing ${multiSelect.length} active multiple_select card(s)...`);

  const batches = chunk(multiSelect, BATCH_SIZE);
  const flagged: { card: Card; audit: CardAudit }[] = [];
  let parseFailures = 0;

  for (const [i, batch] of batches.entries()) {
    console.log(`Batch ${i + 1}/${batches.length} (${batch.length} cards)...`);
    let results: (CardAudit | null)[];
    try {
      results = await auditBatch(batch);
    } catch (err) {
      console.log(`  BATCH FAILED (${err instanceof Error ? err.message : String(err)}) — skipping this batch.`);
      results = batch.map(() => null);
    }

    results.forEach((audit, j) => {
      if (!audit) {
        parseFailures++;
        return;
      }
      const hasWeak = audit.wrongOptionJudgments.some((jud) => jud.verdict === 'generically_weak');
      if (hasWeak) flagged.push({ card: batch[j], audit });
    });
  }

  const byDomain = new Map<string, number>();
  for (const { card } of flagged) byDomain.set(card.domain, (byDomain.get(card.domain) ?? 0) + 1);

  const bySource = new Map<string, number>();
  for (const { card } of flagged) bySource.set(card.sourceType ?? 'unknown', (bySource.get(card.sourceType ?? 'unknown') ?? 0) + 1);

  const report: string[] = [];
  report.push(`Multi-select distractor audit — ${new Date().toISOString()}`);
  report.push(`Checked: ${multiSelect.length}`);
  report.push(`Flagged (>=1 generically weak distractor): ${flagged.length}`);
  report.push(`Audit parse failures (not judged): ${parseFailures}`);
  report.push(`Flagged by domain: ${JSON.stringify(Object.fromEntries(byDomain))}`);
  report.push(`Flagged by source_type: ${JSON.stringify(Object.fromEntries(bySource))}`);
  report.push(`\n========== FLAGGED CARDS (${flagged.length}) ==========`);
  for (const { card, audit } of flagged) report.push(formatFlaggedCard(card, audit));

  const outPath = 'flagged-multiselect.txt';
  writeFileSync(outPath, report.join('\n') + '\n');

  console.log(`\n\n========== SUMMARY ==========`);
  console.log(`Checked: ${multiSelect.length}`);
  console.log(`Flagged (>=1 generically weak distractor): ${flagged.length}`);
  console.log(`Audit parse failures (not judged): ${parseFailures}`);
  console.log('Flagged by domain:', Object.fromEntries(byDomain));
  console.log('Flagged by source_type:', Object.fromEntries(bySource));
  console.log(`\nFull detail on every flagged card written to ${outPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
