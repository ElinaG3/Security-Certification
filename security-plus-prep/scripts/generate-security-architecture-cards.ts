// Generates ~15 new Security Architecture cards to rebalance domain
// weighting after the 2026-09-28 domain/objective correction pulled 12
// cards OUT of this domain (Zero Trust, cloud-service, and vulnerability-
// flavored cards whose objective said otherwise — see
// scripts/backfill-legacy-objectives.ts's commit). That correction was
// right (objective is authoritative), but it left Architecture at 13.8%
// against an 18% target, its worst gap of any domain.
//
// Deliberately scoped to genuine architecture/design content — network
// topology, segmentation, deployment models, resilience — and NOT the
// Zero Trust/cloud-service topics that just got reassigned OUT, so this
// doesn't just recreate the same domain-drift problem under a new batch.
//
// Same pipeline as generate-gsc-cards.ts: batch generate -> structural
// consistency check -> auto-approve as 'active' on a clean pass, retry up
// to 3 attempts, still-failing cards land 'pending' for manual review.
//
// Usage:
//   npx dotenv-cli -- tsx scripts/generate-security-architecture-cards.ts

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import { getCurrentUser } from '../src/lib/auth';
import { AI_MODELS } from '../src/lib/ai-models';
import { shuffleChoiceContent } from '../src/lib/option-order';
import { checkCardConsistency } from './check-card-consistency';

const MODEL = AI_MODELS.content;
const BATCH_SIZE = 5;
const DOMAIN = 'Security Architecture';

const client = new Anthropic();

const QUALIFIERS = ['BEST', 'MOST likely', 'FIRST', 'MOST cost-effective', 'GREATEST risk'] as const;
type Qualifier = (typeof QUALIFIERS)[number];
type LengthTier = 'short' | 'full';

type Slot = {
  objective: string;
  hint: string;
  type: 'multiple_choice' | 'multiple_select';
  requiredCount?: number;
  qualifier: Qualifier;
  lengthTier: LengthTier;
};

// 3.1 Network Infrastructure Concepts / Cloud Infrastructures, 3.2 Firewall
// Types / Network Appliances / Secure Communication, 3.4 Resiliency —
// deliberately skips 1.2 (Zero Trust) and anything cloud-VULNERABILITY-
// flavored (that's 2.x) — this is deployment-model and topology DESIGN
// content only.
const PLAN: Omit<Slot, 'qualifier' | 'lengthTier'>[] = [
  { objective: '3.1', hint: 'designing network segmentation using VLANs to isolate a compromised department from the rest of the network', type: 'multiple_choice' },
  { objective: '3.1', hint: 'choosing physical vs. logical network segmentation to isolate a PCI-DSS cardholder data environment', type: 'multiple_choice' },
  { objective: '3.1', hint: 'comparing on-premises, cloud, and hybrid deployment models where a company must keep sensitive data under direct physical control while bursting capacity to the cloud for seasonal load — an architecture/deployment-model decision, not a cloud vulnerability', type: 'multiple_select', requiredCount: 2 },
  { objective: '3.1', hint: 'placing a screened subnet (DMZ) to expose a public-facing web server without exposing the internal network', type: 'multiple_choice' },
  { objective: '3.1', hint: 'the architectural tradeoffs of a hybrid cloud design vs. a fully on-premises design specifically for disaster-recovery capacity', type: 'multiple_select', requiredCount: 2 },
  { objective: '3.2', hint: 'where in the network topology to place a next-generation firewall for maximum effectiveness', type: 'multiple_choice' },
  { objective: '3.2', hint: 'Layer 3 switch routing vs. requiring a separate router for inter-VLAN traffic, in a segmented network design', type: 'multiple_choice' },
  { objective: '3.2', hint: 'east-west vs. north-south traffic inspection points in a segmented data center network', type: 'multiple_choice' },
  { objective: '3.2', hint: 'designing an out-of-band management network so administrative access stays isolated from production traffic', type: 'multiple_choice' },
  { objective: '3.2', hint: 'selecting the right network appliances (firewall, IPS, load balancer, proxy) to place within a layered defense-in-depth architecture', type: 'multiple_select', requiredCount: 3 },
  { objective: '3.4', hint: 'designing N+1 power and cooling redundancy in a data center to survive a single component failure', type: 'multiple_choice' },
  { objective: '3.4', hint: 'choosing a backup architecture (full/incremental/differential, onsite/offsite, 3-2-1 rule) to meet a stated recovery point objective', type: 'multiple_select', requiredCount: 2 },
  { objective: '3.4', hint: 'geographic replication / multi-site redundancy design to survive a regional disaster', type: 'multiple_choice' },
  { objective: '3.4', hint: 'high-availability clustering and load balancing to eliminate a single point of failure for a critical application', type: 'multiple_select', requiredCount: 2 },
  { objective: '3.4', hint: 'capacity planning tradeoffs when designing infrastructure to absorb peak load without over-provisioning cost', type: 'multiple_choice' },
];

function assignQualifier(indexOverall: number): Qualifier {
  return QUALIFIERS[indexOverall % QUALIFIERS.length];
}

function assignLengthTier(indexOverall: number): LengthTier {
  return indexOverall % 3 === 0 ? 'short' : 'full';
}

function buildSlots(): Slot[] {
  return PLAN.map((p, i) => ({
    ...p,
    qualifier: assignQualifier(i),
    lengthTier: assignLengthTier(i),
  }));
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
const BatchResultSchema = z.object({ cards: z.array(GeneratedCardSchema) });
type GeneratedCard = z.infer<typeof GeneratedCardSchema>;

const submitCardsTool: Anthropic.Tool = {
  name: 'submit_cards',
  description: 'Submit a batch of new CompTIA Security+ (SY0-701) Security Architecture practice questions.',
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

function buildPrompt(slots: Slot[]): string {
  const spec = slots
    .map((s, i) => {
      const lines = [
        `${i + 1}. SY0-701 objective ${s.objective} (Security Architecture)`,
        `   subtopic to test: ${s.hint}`,
        `   type: ${s.type}`,
        `   qualifier: ${s.qualifier}`,
        `   length: ${s.lengthTier}`,
        s.type === 'multiple_select' ? `   requiredCount: ${s.requiredCount}` : null,
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n\n');

  return `Write ${slots.length} original CompTIA Security+ (SY0-701) practice questions for domain 3.0, Security Architecture, one per spec below. Each must be a completely new scenario-based question testing the assigned subtopic.

SCOPE — this is architecture/design content, not adjacent domains that just got separated out of it:
- Test network topology, segmentation, deployment-model tradeoffs (on-prem/cloud/hybrid), appliance placement, and resiliency/redundancy DESIGN decisions.
- Do NOT write about Zero Trust architecture or policy — that's objective 1.2 and is already covered elsewhere.
- Do NOT write about cloud-specific vulnerabilities, misconfigurations, or attack techniques — that's domain 2.0 (Threats, Vulnerabilities, & Mitigations). When a spec mentions cloud/hybrid, keep it at the level of "which deployment model / topology is the right architectural choice for this constraint," never "what could go wrong with this cloud service."

WHY THIS MATTERS: candidate feedback on the real SY0-701 exam consistently says the hard part isn't obscure facts — it's that multiple options all look correct, and you must pick the BEST one by CompTIA's logic. These must recreate that difficulty, not test rote recall.

EVERY QUESTION — including multiple_select — has EXACTLY 4 options TOTAL. Never 5, never 6. options.length === 4 always. This is non-negotiable: for a multiple_select card with requiredCount 2, that means exactly 2 correct + 2 incorrect = 4 total, not 2 correct + 3 incorrect.

EVERY QUESTION:
- Each spec below carries its own "qualifier" and "length" — follow BOTH exactly as assigned, do not substitute your own choice or default to BEST/full-scenario.
- length "full": 2-4 sentences of realistic organizational scenario (a company, a role, a constraint, an incident in progress) before the question itself.
- length "short": 0-2 sentences of setup — even a direct, compact one-line question is fine here. Real exam questions aren't all elaborate scenarios.
- End every question with its assigned qualifier, worded naturally (e.g. "Which of the following is the FIRST step..." / "...the MOST cost-effective solution?" / "...poses the GREATEST risk?"). For multiple_select, phrase around selecting multiple (e.g. "Which TWO of the following...") while still ending on the assigned qualifier where it fits naturally.
- All 4 options must be real, plausible, legitimate architecture/design choices — never a throwaway or nonsensical distractor. For multiple_choice: at least TWO of the four must be genuinely defensible; only ONE is the BEST answer. For multiple_select: exactly requiredCount are correct, and the remaining (4 - requiredCount) are plausible-but-inferior in the same grounded way.

multiple_select DISTRACTOR QUALITY — this is exactly where generated "Choose two/three" questions tend to go weak: every wrong option must be a legitimate, real-world architecture choice a competent practitioner might genuinely reach for — plausible in general, wrong ONLY because of a specific detail in THIS scenario (wrong layer, wrong scale, wrong cost tier, solves a different problem). If a wrong option could be eliminated just by recognizing it's not a real or sensible design choice — without needing to read the scenario at all — rewrite it.

DISTRACTOR EXPLANATIONS — the highest-value part, do not skimp:
- EVERY wrong option, no exceptions, gets a real, specific, non-empty explanation written out in full.
- Each one must say SPECIFICALLY why it is worse in THIS scenario, not merely "wrong" or a restatement of the correct answer. Ground each one in something concrete: wrong architectural layer, fails a specific constraint stated in the scenario (cost, scale, compliance, physical control), or is a real design pattern that solves a different, adjacent problem than the one described.
- The top-level 'explanation' field must be genuine prose, written out in full, explaining why the correct answer(s) are BEST.

distractorExplanations ARRAY ALIGNMENT — this has been a source of bugs, follow it exactly:
- distractorExplanations must have EXACTLY the same length as options (4), one entry per option, in the SAME ORDER as options — do not build it by skipping the correct option and only listing the wrong ones. A 4-option card gets a 4-entry distractorExplanations array, always, never 3.
- The entry at each correct index (single index for multiple_choice, every index in correct[] for multiple_select) must be the empty string "".
- Every other index must have a non-empty, option-specific explanation.
- Before finalizing each card, verify: len(distractorExplanations) === len(options) === 4, and distractorExplanations[i] === "" if and only if i is a correct index.

multiple_select cards: the question text MUST end with "(Choose ${'{requiredCount}'}.)" matching the spec's requiredCount exactly (e.g. "(Choose two.)" or "(Choose three.)"). correct must be an array with exactly requiredCount indices, options must still have exactly 4 entries total.

topic: a short 2-5 word label for this specific question's subtopic (e.g. "DMZ Placement", "N+1 Redundancy").
authoredDifficulty: "application" or "analysis" only — never "recall". These are judgment calls, not fact lookups, so do not include a mnemonic.

Specs:
${spec}

Call submit_cards with exactly ${slots.length} entries, in the same order as the specs above.`;
}

async function generateBatch(slots: Slot[]): Promise<(GeneratedCard | null)[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    tools: [submitCardsTool],
    tool_choice: { type: 'tool', name: 'submit_cards' },
    messages: [{ role: 'user', content: buildPrompt(slots) }],
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
    if (parsed.success) return shuffleChoiceContent(parsed.data);
    console.log(`  GENERATION PARSE FAILURE for slot ${i}:`);
    console.log(`    ${parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ')}`);
    return null;
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
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

async function runPass(slots: Slot[]): Promise<PassResult[]> {
  const batches = chunk(slots, BATCH_SIZE);
  const results: PassResult[] = [];

  for (const [i, batch] of batches.entries()) {
    console.log(`  Batch ${i + 1}/${batches.length} (${batch.length} cards)...`);

    let generated: (GeneratedCard | null)[];
    try {
      generated = await generateBatch(batch);
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
      const issues = findIssues(card, contentFromCard(card));
      results.push({ slot, card, issues });
    }
  }

  return results;
}

const MAX_ATTEMPTS = 3;

async function main() {
  const db = getDb();
  const user = await getCurrentUser();

  const initialSlots = buildSlots();
  console.log(`Generating ${initialSlots.length} new ${DOMAIN} card(s)...`);

  let approvedCount = 0;
  let currentSlots = initialSlots;
  const lastAttempt = new Map<Slot, PassResult>();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && currentSlots.length > 0; attempt++) {
    console.log(`\nAttempt ${attempt}/${MAX_ATTEMPTS}: ${currentSlots.length} card(s)...`);
    const results = await runPass(currentSlots);
    const stillFailing: Slot[] = [];

    for (const result of results) {
      const { slot, card, issues } = result;
      lastAttempt.set(slot, result);

      if (card && issues.length === 0) {
        await db.insert(cards).values({
          userId: user.id,
          domain: DOMAIN,
          topic: card.topic,
          type: card.type,
          content: contentFromCard(card),
          status: 'active',
          sourceType: 'generated',
          authoredDifficulty: card.authoredDifficulty,
          objective: slot.objective,
        });
        approvedCount++;
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
        domain: DOMAIN,
        topic: result.card.topic,
        type: result.card.type,
        content: contentFromCard(result.card),
        status: 'pending',
        sourceType: 'generated',
        authoredDifficulty: result.card.authoredDifficulty,
        objective: slot.objective,
      });
      flaggedCount++;
      console.log(`\nFLAGGED after ${MAX_ATTEMPTS} attempts (left pending): objective ${slot.objective} / ${slot.hint}`);
      for (const issue of result.issues) console.log(`  - ${issue}`);
    } else {
      genFailedCount++;
      console.log(`\nGENERATION FAILED after ${MAX_ATTEMPTS} attempts (nothing inserted): objective ${slot.objective} / ${slot.hint}`);
    }
  }

  console.log(`\nDone. Auto-approved ${approvedCount}, flagged for review ${flaggedCount}, generation failures ${genFailedCount}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
