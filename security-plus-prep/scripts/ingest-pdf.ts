// Phase 4: ingest a text-based SY0-701 source PDF into new scenario-style
// cards. Pipeline:
//
//   1. Extract text (pdf-parse — no AI call; the source is typed, not
//      scanned, so OCR/vision isn't needed here).
//   2. Chunk it by the source's own section headers ("1.3 - Change
//      Management") and sub-headings, giving each chunk a parsed exam
//      objective for free.
//   3. Embed every chunk with a local model (AI_MODELS.embedding — no API
//      key, no per-chunk Claude call) and persist it to ingested_chunks so
//      re-running this script never re-parses or re-embeds the same file.
//   4. Score each not-yet-used chunk's max cosine similarity against every
//      active card's embedding. High similarity = the concept is already
//      well covered — skip it. This is the "duplicate-coverage detection"
//      the embeddings exist for.
//   5. Take the most-novel chunks, up to MAX_CARDS_PER_RUN, and generate
//      cards from them with the same scenario style, qualifier/length
//      variety, and consistency-check + 3-attempt-retry + auto-approve
//      gate as scripts/generate-gsc-cards.ts.
//
// A source file is refused outright if its name matches DENYLIST_PATTERNS
// (currently just SY0-601 — two exam versions out of date).
//
// Usage:
//   npx dotenv-cli -- tsx scripts/ingest-pdf.ts [path-to-pdf] [--certification-id=<uuid>]
//   (defaults to Professor Messer's SY0-701 course notes in ~/Downloads,
//   and to the SY0-701 certification row when --certification-id is
//   omitted — genuinely reusable across certs: it derives domain/exam-name
//   from the target certification row and objectives table, not a
//   hardcoded plan, since this script is driven by the source PDF's own
//   content rather than hand-authored per-objective hints.)

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards, ingestedChunks } from '../src/db/schema';
import { getCurrentUser } from '../src/lib/auth';
import { AI_MODELS } from '../src/lib/ai-models';
import { shuffleChoiceContent } from '../src/lib/option-order';
import { extractPdfPages, chunkPdfPages, persistChunks, scoreChunkNovelty } from '../src/lib/pdf-ingestion';
import { parseCertificationIdArg, resolveCliCertification, domainForObjectiveIn, type CliCertification } from './cli-certification';
import { checkCardConsistency } from './check-card-consistency';

const MODEL = AI_MODELS.content;
const BATCH_SIZE = 5;
const MS_SHARE = 0.25;
const MAX_CARDS_PER_RUN = 30;
// Cosine similarity (local MiniLM, both vectors normalized) above which a
// chunk is considered "already well covered" by an existing active card
// and skipped. Calibrated against this actual corpus, not a generic
// guess: comparing a full section-length chunk against short card text
// compresses scores well below the sentence-vs-sentence range (~0.75-0.9)
// — across all 163 Messer chunks vs. 265 active cards, the max observed
// was 0.77, with a clear cluster at 0.70-0.77 for topics already heavily
// tested (Firewalls, DNS Attacks, MFA, Zero Trust, Vulnerability
// Remediation) and everything else below 0.70. If re-run against a
// differently-shaped source, sanity-check the score distribution before
// trusting this number.
const DUPLICATE_SIMILARITY_THRESHOLD = 0.7;

const DEFAULT_PDF_PATH = '/home/elina/Downloads/professor-messer-sy0-701-comptia-security-plus-course-notes-v107.pdf';

// Exam versions two-or-more generations old never get ingested, regardless
// of how the pipeline is invoked — filenames only, deliberately simple.
const DENYLIST_PATTERNS = [/sy0[-_ ]?601/i];

const client = new Anthropic();

// ---------------------------------------------------------------------
// 5. Card generation — same style/qualifier/length rules as
// generate-gsc-cards.ts, sourced from a chunk instead of a fixed plan.
// ---------------------------------------------------------------------

const QUALIFIERS = ['BEST', 'MOST likely', 'FIRST', 'MOST cost-effective', 'GREATEST risk'] as const;
type Qualifier = (typeof QUALIFIERS)[number];
type LengthTier = 'short' | 'full';

type Slot = {
  chunk: typeof ingestedChunks.$inferSelect;
  domain: string;
  type: 'multiple_choice' | 'multiple_select';
  requiredCount?: number;
  qualifier: Qualifier;
  lengthTier: LengthTier;
};

const SEQUENCE_RE = /incident response|forensic|disaster recovery|business continuit|change management|backout|rollback|change control/i;

function assignQualifier(sectionTitle: string, indexInSection: number, indexOverall: number): Qualifier {
  if (SEQUENCE_RE.test(sectionTitle)) {
    return indexInSection % 3 === 2 ? 'GREATEST risk' : 'FIRST';
  }
  return QUALIFIERS[indexOverall % QUALIFIERS.length];
}

function assignLengthTier(indexOverall: number): LengthTier {
  return indexOverall % 3 === 0 ? 'short' : 'full';
}

function buildSlots(selected: (typeof ingestedChunks.$inferSelect)[], cert: CliCertification): Slot[] {
  const sectionCounters = new Map<string, number>();
  const fallbackDomain = cert.domains[0]?.name ?? 'General';
  return selected.map((chunk, i) => {
    const key = chunk.sectionTitle ?? '';
    const secIndex = sectionCounters.get(key) ?? 0;
    sectionCounters.set(key, secIndex + 1);
    const isMs = i % 4 === 3; // ~25%
    return {
      chunk,
      domain: (chunk.objective && domainForObjectiveIn(cert, chunk.objective)) ?? fallbackDomain,
      type: isMs ? ('multiple_select' as const) : ('multiple_choice' as const),
      requiredCount: isMs ? (i % 8 === 3 ? 3 : 2) : undefined,
      qualifier: assignQualifier(key, secIndex, i),
      lengthTier: assignLengthTier(i),
    };
  });
}

const GeneratedCardSchema = z.object({
  type: z.enum(['multiple_choice', 'multiple_select']),
  topic: z.string(),
  authoredDifficulty: z.enum(['application', 'analysis']),
  question: z.string(),
  options: z.array(z.string()),
  correct: z.union([z.number(), z.array(z.number())]),
  requiredCount: z.number().optional(),
  explanation: z.string(),
  distractorExplanations: z.array(z.string()),
});
type GeneratedCard = z.infer<typeof GeneratedCardSchema>;

function submitCardsTool(cert: CliCertification): Anthropic.Tool {
  return {
  name: 'submit_cards',
  description: `Submit a batch of new ${cert.name} (${cert.examCode}) practice questions derived from source study notes.`,
  input_schema: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['multiple_choice', 'multiple_select'] },
            topic: { type: 'string', description: 'Short 2-5 word topic label for this specific question' },
            authoredDifficulty: { type: 'string', enum: ['application', 'analysis'] },
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            correct: {
              description: 'Index into options for multiple_choice, array of indices for multiple_select',
              oneOf: [{ type: 'integer' }, { type: 'array', items: { type: 'integer' } }],
            },
            requiredCount: { type: 'integer', description: 'multiple_select only: how many options must be picked' },
            explanation: { type: 'string', description: 'Why the correct answer is BEST' },
            distractorExplanations: {
              type: 'array',
              items: { type: 'string' },
              description:
                'MUST have exactly options.length entries, same order as options. "" at every correct index, a context-specific reason at every other index.',
            },
          },
          required: ['type', 'topic', 'authoredDifficulty', 'question', 'options', 'correct', 'explanation', 'distractorExplanations'],
        },
      },
    },
    required: ['cards'],
  },
  };
}

function buildPrompt(slots: Slot[], cert: CliCertification): string {
  const spec = slots
    .map((s, i) => {
      const lines = [
        `${i + 1}. domain: "${s.domain}", ${cert.examCode} objective ${s.chunk.objective} (${s.chunk.sectionTitle})`,
        `   type: ${s.type}`,
        `   qualifier: ${s.qualifier}`,
        `   length: ${s.lengthTier}`,
        s.type === 'multiple_select' ? `   requiredCount: ${s.requiredCount}` : null,
        `   source material (test this concept — do NOT copy this wording or format into the question):`,
        `   """${s.chunk.content}"""`,
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n\n');

  return `Write ${slots.length} original ${cert.name} (${cert.examCode}) practice questions, one per spec below. Each spec's "source material" is raw outline notes on the concept to test — turn it into a scenario-based question, never a fill-in-the-blank restatement of the notes themselves.

WHY THIS MATTERS: candidate feedback on the real ${cert.examCode} exam consistently says the hard part isn't obscure facts — it's that multiple options all look correct, and you must pick the BEST one by the exam's own logic. These must recreate that difficulty, not test rote recall of the source notes.

EVERY QUESTION — including multiple_select — has EXACTLY 4 options TOTAL. Never 5, never 6. options.length === 4 always. This is non-negotiable: for a multiple_select card with requiredCount 2, that means exactly 2 correct + 2 incorrect = 4 total, not 2 correct + 3 incorrect.

EVERY QUESTION:
- Each spec below carries its own "qualifier" and "length" — follow BOTH exactly as assigned, do not substitute your own choice or default to BEST/full-scenario.
- length "full": 2-4 sentences of realistic organizational scenario (a company, a role, a constraint, an incident in progress) before the question itself.
- length "short": 0-2 sentences of setup — even a direct, compact one-line question is fine here.
- qualifier "FIRST": the question is about sequence/priority — "what should be done FIRST" — and at least two options must be real, later-but-still-correct steps in the same process, not just wrong actions. This applies especially to change-management, incident-response, and disaster-recovery specs, where getting the order right is the actual skill being tested.
- End every question with its assigned qualifier, worded naturally. For multiple_select, phrase around selecting multiple (e.g. "Which TWO of the following...") while still ending on the assigned qualifier where it fits naturally.
- All 4 options must be real, plausible, legitimate security controls or concepts drawn from the same subject area as the source material — never a throwaway or nonsensical distractor. For multiple_choice: at least TWO of the four must be genuinely defensible; only ONE is BEST. For multiple_select: exactly requiredCount are correct, the rest plausible-but-inferior.

multiple_select DISTRACTOR QUALITY — this is exactly where generated "Choose two/three" questions tend to go weak: every wrong option must be a legitimate, real-world control a competent practitioner might genuinely reach for — plausible in general, wrong ONLY because of a specific detail in THIS scenario (wrong layer, wrong phase, wrong scope, wrong cost tier, solves a different risk). If a wrong option could be eliminated just by recognizing it's not a real or sensible control — without needing to read the scenario at all — rewrite it. A test-taker should need to understand the scenario to eliminate every wrong option, never just skim the option list and spot the silly ones.

DISTRACTOR EXPLANATIONS — the highest-value part, do not skimp:
- EVERY wrong option, no exceptions, gets a real, specific, non-empty explanation written out in full, saying SPECIFICALLY why it is worse in THIS scenario.
- The top-level 'explanation' field must be genuine prose explaining why the correct answer(s) are BEST.

distractorExplanations ARRAY ALIGNMENT — this has been a source of bugs, follow it exactly:
- distractorExplanations must have EXACTLY the same length as options (4), one entry per option, in the SAME ORDER as options.
- The entry at each correct index (single index for multiple_choice, every index in correct[] for multiple_select) must be the empty string "".
- Every other index must have a non-empty, option-specific explanation.
- Before finalizing each card, verify: len(distractorExplanations) === len(options) === 4, and distractorExplanations[i] === "" if and only if i is a correct index.

multiple_select cards: the question text MUST end with "(Choose ${'{requiredCount}'}.)" matching the spec's requiredCount exactly. correct must be an array with exactly requiredCount indices, options must still have exactly 4 entries total.

topic: a short 2-5 word label for this specific question's subtopic.
authoredDifficulty: "application" or "analysis" only — never "recall". These are judgment calls, not fact lookups, so do not include a mnemonic.

Specs:
${spec}

Call submit_cards with exactly ${slots.length} entries, in the same order as the specs above.`;
}

async function generateBatch(slots: Slot[], cert: CliCertification): Promise<(GeneratedCard | null)[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    tools: [submitCardsTool(cert)],
    tool_choice: { type: 'tool', name: 'submit_cards' },
    messages: [{ role: 'user', content: buildPrompt(slots, cert) }],
  });

  const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in response');

  const rawCardsField = (toolUse.input as { cards?: unknown })?.cards;
  const rawCards = Array.isArray(rawCardsField) ? rawCardsField : [];
  if (!Array.isArray(rawCardsField)) {
    console.log(`  GENERATION FAILURE: tool input 'cards' was not an array (got ${typeof rawCardsField})`);
  }
  return rawCards.map((raw, i) => {
    const parsed = GeneratedCardSchema.safeParse(raw);
    // Shuffled here, before this draft ever reaches the DB — the model
    // reliably writes the correct answer first if left to its own devices.
    if (parsed.success) return shuffleChoiceContent(parsed.data);
    console.log(`  GENERATION PARSE FAILURE for slot ${i} (objective ${slots[i]?.chunk.objective}):`);
    console.log(`    ${parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ')}`);
    return null;
  });
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function contentFromCard(card: GeneratedCard) {
  const correct = card.correct;
  const correctIndices = Array.isArray(correct) ? correct : [correct];
  return card.type === 'multiple_select'
    ? {
        question: card.question,
        options: card.options,
        correct: correctIndices,
        requiredCount: card.requiredCount ?? correctIndices.length,
        explanation: card.explanation,
        distractorExplanations: card.distractorExplanations,
      }
    : {
        question: card.question,
        options: card.options,
        correct: correctIndices[0],
        explanation: card.explanation,
        distractorExplanations: card.distractorExplanations,
      };
}

function findIssues(card: GeneratedCard, content: ReturnType<typeof contentFromCard>): string[] {
  const issues = checkCardConsistency(content as any, card.type);
  if (card.options.length !== 4) issues.push(`expected exactly 4 options, got ${card.options.length}`);
  return issues;
}

type PassResult = { slot: Slot; card: GeneratedCard | null; issues: string[] };

async function runPass(slots: Slot[], cert: CliCertification): Promise<PassResult[]> {
  const batches = chunkArray(slots, BATCH_SIZE);
  const results: PassResult[] = [];

  for (const [i, batch] of batches.entries()) {
    console.log(`  Batch ${i + 1}/${batches.length} (${batch.length} cards)...`);

    let generated: (GeneratedCard | null)[];
    try {
      generated = await generateBatch(batch, cert);
    } catch (err) {
      console.log(`    BATCH FAILED (${err instanceof Error ? err.message : String(err)}) — all ${batch.length} card(s) in this batch will retry.`);
      generated = batch.map(() => null);
    }

    if (generated.length !== batch.length) {
      console.log(`    NOTE: requested ${batch.length}, model returned ${generated.length} — matched by position.`);
    }

    for (let j = 0; j < batch.length; j++) {
      const slot = batch[j];
      const card = generated[j] ?? null;
      if (!card) {
        results.push({ slot, card: null, issues: ['generation parse failure'] });
        continue;
      }
      results.push({ slot, card, issues: findIssues(card, contentFromCard(card)) });
    }
  }

  return results;
}

const MAX_ATTEMPTS = 3;

async function main() {
  // Positional path arg, distinct from --flags so `--certification-id=`
  // can appear before or after it.
  const sourcePath = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? DEFAULT_PDF_PATH;
  const sourceFile = basename(sourcePath);

  const cert = await resolveCliCertification(parseCertificationIdArg());
  console.log(`Target certification: ${cert.name} (${cert.examCode})`);

  if (DENYLIST_PATTERNS.some((re) => re.test(sourceFile))) {
    console.error(`Refusing to ingest "${sourceFile}" — matches the exam-version denylist (too old to be worth ingesting).`);
    process.exit(1);
  }

  console.log(`Extracting text from ${sourceFile}...`);
  const buffer = await readFile(sourcePath);
  const { pages, pageCount } = await extractPdfPages(buffer);
  console.log(`${pageCount} page(s) extracted.`);

  const rawChunks = chunkPdfPages(pages);
  console.log(`Parsed ${rawChunks.length} content chunk(s).`);

  // No Library entry (pdfId: null) — this is a local file, never uploaded
  // to Blob, so there's no in-app-viewable PDF for these chunks to link
  // to. Upload the same file through the Library UI instead if you want
  // page-linked chunks from it.
  const chunkRows = await persistChunks({ certificationId: cert.id, pdfId: null, sourceFile, rawChunks });
  await scoreChunkNovelty(cert.id, chunkRows);

  const eligible = chunkRows
    .filter((c) => !c.usedForGeneration && c.objective !== null)
    .filter((c) => (c.maxCardSimilarity ?? 0) < DUPLICATE_SIMILARITY_THRESHOLD)
    .sort((a, b) => (a.maxCardSimilarity ?? 0) - (b.maxCardSimilarity ?? 0)); // most novel first

  const skippedDuplicate = chunkRows.filter(
    (c) => !c.usedForGeneration && c.objective !== null && (c.maxCardSimilarity ?? 0) >= DUPLICATE_SIMILARITY_THRESHOLD
  ).length;
  console.log(
    `${eligible.length} chunk(s) eligible (novel, unused); ${skippedDuplicate} skipped as already well-covered (similarity >= ${DUPLICATE_SIMILARITY_THRESHOLD}).`
  );

  const selected = eligible.slice(0, MAX_CARDS_PER_RUN);
  console.log(`Generating from ${selected.length} chunk(s) this run (capped at ${MAX_CARDS_PER_RUN}).`);
  if (selected.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const db = getDb();
  const user = await getCurrentUser();

  let approvedCount = 0;
  let currentSlots = buildSlots(selected, cert);
  const lastAttempt = new Map<Slot, PassResult>();
  const resolvedChunkIds = new Set<string>();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && currentSlots.length > 0; attempt++) {
    console.log(`\nAttempt ${attempt}/${MAX_ATTEMPTS}: ${currentSlots.length} card(s)...`);
    const results = await runPass(currentSlots, cert);
    const stillFailing: Slot[] = [];

    for (const result of results) {
      const { slot, card, issues } = result;
      lastAttempt.set(slot, result);

      if (card && issues.length === 0) {
        await db.insert(cards).values({
          userId: user.id,
          certificationId: cert.id,
          domain: slot.domain,
          topic: card.topic,
          type: card.type,
          content: contentFromCard(card),
          status: 'active',
          sourceType: 'pdf',
          sourceRef: slot.chunk.id,
          authoredDifficulty: card.authoredDifficulty,
          objective: slot.chunk.objective,
        });
        approvedCount++;
        resolvedChunkIds.add(slot.chunk.id);
        lastAttempt.delete(slot);
      } else {
        stillFailing.push(slot);
      }
    }

    currentSlots = stillFailing;
  }

  let flaggedCount = 0;
  let genFailedCount = 0;
  for (const slot of currentSlots) {
    const result = lastAttempt.get(slot);
    if (result?.card) {
      await db.insert(cards).values({
        userId: user.id,
        certificationId: cert.id,
        domain: slot.domain,
        topic: result.card.topic,
        type: result.card.type,
        content: contentFromCard(result.card),
        status: 'pending',
        sourceType: 'pdf',
        sourceRef: slot.chunk.id,
        authoredDifficulty: result.card.authoredDifficulty,
        objective: slot.chunk.objective,
      });
      flaggedCount++;
      resolvedChunkIds.add(slot.chunk.id);
      console.log(`\nFLAGGED after ${MAX_ATTEMPTS} attempts (left pending): ${slot.chunk.objective} / ${slot.chunk.sectionTitle}`);
      for (const issue of result.issues) console.log(`  - ${issue}`);
    } else {
      genFailedCount++;
      console.log(`\nGENERATION FAILED after ${MAX_ATTEMPTS} attempts (chunk left available for a future run): ${slot.chunk.objective} / ${slot.chunk.sectionTitle}`);
    }
  }

  if (resolvedChunkIds.size > 0) {
    await db
      .update(ingestedChunks)
      .set({ usedForGeneration: true })
      .where(sql`${ingestedChunks.id} IN (${sql.join([...resolvedChunkIds].map((id) => sql`${id}`), sql`, `)})`);
  }

  const alreadyUsedBefore = chunkRows.filter((c) => c.usedForGeneration).length;
  const remaining = chunkRows.length - alreadyUsedBefore - resolvedChunkIds.size;
  console.log(`\nDone. Auto-approved ${approvedCount}, flagged for review ${flaggedCount}, generation failures ${genFailedCount}.`);
  console.log(`${remaining} chunk(s) remain in ingested_chunks (unused or filtered as duplicate) for a future run.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
