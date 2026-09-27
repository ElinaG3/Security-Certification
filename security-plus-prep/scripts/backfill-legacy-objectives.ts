// One-time backfill: the 135 legacy seed cards have no `objective` set,
// which orphans them from every objective-keyed feature (Topics hub pages,
// ingestedChunks joins). Classifies each into the SY0-701 objective number
// it best fits, using Sonnet with the card's own domain (trusted, already
// set) constraining the choice to that domain's known objectives.
//
// LIMITATION: we don't have the official SY0-701 objectives PDF yet (only
// SY0-801's sits in ~/Downloads, and that's out of scope), so "known
// objectives per domain" means only the ~31 numbers already represented
// somewhere in this DB (via other cards' `objective` or ingestedChunks) —
// not the full official list. A legacy card whose real objective isn't
// among those 31 gets the closest available fit. Re-classify against the
// full list once the real PDF is added.
//
// Two-phase, matching the "show me a sample before applying" requirement:
//   1. Default (no flag): classifies via Sonnet, writes results to
//      scripts/_backfill-output.json, prints a report. No DB writes.
//   2. --apply: reads that JSON (does NOT re-classify) and writes
//      `objective` for all 135 cards in one pass.
//
// Usage:
//   npx dotenv-cli -- tsx scripts/backfill-legacy-objectives.ts
//   npx dotenv-cli -- tsx scripts/backfill-legacy-objectives.ts --apply

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { eq, isNull, isNotNull } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards, ingestedChunks } from '../src/db/schema';
import { AI_MODELS } from '../src/lib/ai-models';
import { DOMAIN_BY_OBJECTIVE_PREFIX } from '../src/lib/domains';
import type { MultipleChoiceContent, MultipleSelectContent } from '../src/db/question-types';

const OUTPUT_PATH = 'scripts/_backfill-output.json';
const BATCH_SIZE = 6;
const client = new Anthropic();

type LegacyCard = typeof cards.$inferSelect;

// DOMAIN_BY_OBJECTIVE_PREFIX (src/lib/domains.ts) is authoritative — an
// objective NUMBER's domain is fixed by its prefix, per the official
// SY0-701 domain structure. Deliberately NOT derived from existing cards'
// own `domain` column: a DB audit while building this script found 33/328
// already-classified cards where domain and objective disagree (e.g.
// objective 5.2 tagged under "General Security Concepts" instead of
// "Security Program Management and Oversight") — trusting that column
// would propagate those mismatches into the legacy backfill too.

async function buildObjectiveHints(): Promise<Map<string, Map<string, Set<string>>>> {
  // domain -> objective -> set of hint titles (from ingestedChunks sectionTitle, where available)
  const db = getDb();
  const hints = new Map<string, Map<string, Set<string>>>();

  const withObjective = await db.select({ objective: cards.objective }).from(cards).where(isNotNull(cards.objective));
  const chunkObjectives = await db
    .select({ objective: ingestedChunks.objective })
    .from(ingestedChunks)
    .where(isNotNull(ingestedChunks.objective));

  const allObjectives = new Set([...withObjective.map((c) => c.objective!), ...chunkObjectives.map((c) => c.objective!)]);
  for (const objective of allObjectives) {
    const domain = DOMAIN_BY_OBJECTIVE_PREFIX[objective.split('.')[0]];
    if (!domain) continue; // unrecognized prefix — skip rather than guess
    if (!hints.has(domain)) hints.set(domain, new Map());
    hints.get(domain)!.set(objective, new Set());
  }

  const chunks = await db
    .select({ objective: ingestedChunks.objective, sectionTitle: ingestedChunks.sectionTitle })
    .from(ingestedChunks)
    .where(isNotNull(ingestedChunks.objective));
  for (const [, domainMap] of hints) {
    for (const [objective, titles] of domainMap) {
      for (const c of chunks) {
        if (c.objective === objective && c.sectionTitle) titles.add(c.sectionTitle);
      }
    }
  }

  return hints;
}

function cardSummary(c: MultipleChoiceContent | MultipleSelectContent): string {
  return `Q: ${c.question}\nOptions: ${c.options.join(' | ')}\nExplanation: ${c.explanation}`;
}

const ClassificationSchema = z.object({
  classifications: z.array(
    z.object({
      index: z.number(),
      objective: z.string(),
      confidence: z.enum(['high', 'medium', 'low']),
      reasoning: z.string(),
    })
  ),
});

const classifyTool: Anthropic.Tool = {
  name: 'classify_cards',
  description: 'Classify each card into the SY0-701 objective number it best fits.',
  input_schema: {
    type: 'object',
    properties: {
      classifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer', description: 'The card index from the prompt' },
            objective: { type: 'string', description: 'One of the allowed objective numbers, e.g. "1.2"' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            reasoning: { type: 'string', description: 'One short sentence' },
          },
          required: ['index', 'objective', 'confidence', 'reasoning'],
        },
      },
    },
    required: ['classifications'],
  },
};

async function classifyBatch(
  domain: string,
  allowedObjectives: [string, Set<string>][],
  batch: { index: number; card: LegacyCard }[]
) {
  const objectivesList = allowedObjectives
    .map(([obj, titles]) => `${obj}${titles.size > 0 ? ` (covers: ${[...titles].slice(0, 5).join(', ')})` : ''}`)
    .join('\n');

  const cardsList = batch
    .map(({ index, card }) => `[${index}] topic: "${card.topic}"\n${cardSummary(card.content as MultipleChoiceContent | MultipleSelectContent)}`)
    .join('\n\n');

  const prompt = `Domain: "${domain}". Classify each card below into the SY0-701 objective number it best tests, choosing ONLY from this list (the domain is already fixed/correct — just pick the right sub-objective):

${objectivesList}

Cards:
${cardsList}

For each card index above, call classify_cards with its best-fit objective, a confidence level, and one short sentence of reasoning. If a card doesn't cleanly fit any listed objective, pick the closest one and mark confidence "low".`;

  const response = await client.messages.create({
    model: AI_MODELS.content,
    max_tokens: 4096,
    tools: [classifyTool],
    tool_choice: { type: 'tool', name: 'classify_cards' },
    messages: [{ role: 'user', content: prompt }],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in response');
  return ClassificationSchema.parse(toolUse.input).classifications;
}

type Result = {
  cardId: string;
  domain: string;
  topic: string;
  question: string;
  objective: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
};

async function main() {
  const apply = process.argv.includes('--apply');
  const db = getDb();

  if (apply) {
    if (!existsSync(OUTPUT_PATH)) {
      console.error(`No classification output found at ${OUTPUT_PATH} — run without --apply first.`);
      process.exit(1);
    }
    const results: Result[] = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
    console.log(`Applying ${results.length} classification(s) to the DB...`);
    for (const r of results) {
      await db.update(cards).set({ objective: r.objective, updatedAt: new Date() }).where(eq(cards.id, r.cardId));
    }
    console.log(`Done. ${results.length} card(s) updated.`);
    return;
  }

  const legacy = await db.select().from(cards).where(isNull(cards.objective));
  console.log(`${legacy.length} legacy card(s) with no objective.`);

  const hints = await buildObjectiveHints();

  const byDomain = new Map<string, LegacyCard[]>();
  for (const c of legacy) {
    if (!byDomain.has(c.domain)) byDomain.set(c.domain, []);
    byDomain.get(c.domain)!.push(c);
  }

  const allResults: Result[] = [];

  for (const [domain, domainCards] of byDomain) {
    const allowed = [...(hints.get(domain) ?? new Map())].sort(([a], [b]) => a.localeCompare(b));
    if (allowed.length === 0) {
      console.log(`WARNING: no known objectives for domain "${domain}" — skipping ${domainCards.length} card(s).`);
      continue;
    }

    console.log(`\n${domain}: ${domainCards.length} card(s), ${allowed.length} known objective(s)...`);

    for (let i = 0; i < domainCards.length; i += BATCH_SIZE) {
      const batchCards = domainCards.slice(i, i + BATCH_SIZE);
      const batch = batchCards.map((card, j) => ({ index: i + j, card }));
      console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(domainCards.length / BATCH_SIZE)}...`);

      const classifications = await classifyBatch(domain, allowed, batch);
      for (const cls of classifications) {
        const match = batch.find((b) => b.index === cls.index);
        if (!match) continue;
        const content = match.card.content as MultipleChoiceContent | MultipleSelectContent;
        allResults.push({
          cardId: match.card.id,
          domain,
          topic: match.card.topic,
          question: content.question,
          objective: cls.objective,
          confidence: cls.confidence,
          reasoning: cls.reasoning,
        });
      }
    }
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(allResults, null, 2));

  console.log(`\n\n=== SAMPLE (first 20 of ${allResults.length}) ===\n`);
  for (const r of allResults.slice(0, 20)) {
    console.log(`[${r.confidence.toUpperCase()}] ${r.objective} <- "${r.topic}" (${r.domain})`);
    console.log(`  Q: ${r.question.slice(0, 100)}${r.question.length > 100 ? '...' : ''}`);
    console.log(`  why: ${r.reasoning}`);
  }

  const byConfidence = { high: 0, medium: 0, low: 0 };
  for (const r of allResults) byConfidence[r.confidence]++;
  console.log(`\nConfidence breakdown: high=${byConfidence.high}, medium=${byConfidence.medium}, low=${byConfidence.low}`);
  console.log(`Classified ${allResults.length}/${legacy.length}.`);
  console.log(`\nFull results written to ${OUTPUT_PATH}. Review, then re-run with --apply to write to the DB.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
