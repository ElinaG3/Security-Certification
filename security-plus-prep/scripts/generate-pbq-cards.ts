// Generates real PBQ content (log_analysis, config_table, remediation_select)
// via Sonnet, following the same tool-call + zod-validation + structural-
// consistency-check + auto-approve pattern as generate-cards.ts /
// generate-fillin-cards.ts.
//
// log_analysis and config_table share one content shape (ArtifactPbqContent)
// and are generated together here — only artifact.kind differs. Sub-question
// answerMode is kept to 'options' and 'artifact_rows' only (skipping
// 'cell_value'): both of those work against either a log or table artifact,
// which keeps one tool schema and one consistency check covering both types
// instead of forking logic for a third, table-only answerMode.
//
// Usage:
//   npx dotenv-cli -c -- npx tsx scripts/generate-pbq-cards.ts --dry-run
//   npx dotenv-cli -c -- npx tsx scripts/generate-pbq-cards.ts --sample
//   npx dotenv-cli -c -- npx tsx scripts/generate-pbq-cards.ts [--certification-id=<uuid>]
//
// --dry-run prints the plan (which slots would actually generate, after
// skipping objective+type combos that already have a card, and an estimated
// AI-call count) and exits — no AI calls, no DB writes.
// --sample generates one card per type (3 total, ignoring idempotency) and
// only prints them.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import { getCurrentUser } from '../src/lib/auth';
import { AI_MODELS } from '../src/lib/ai-models';
import { randomOrder, applyOrder, invertOrder } from '../src/lib/option-order';
import { checkArtifactPbqConsistency, checkRemediationConsistency } from './check-card-consistency';
import type { ArtifactPbqContent, RemediationSelectContent } from '../src/db/question-types';
import { parseCertificationIdArg, resolveCliCertification, requireSy0701, type CliCertification } from './cli-certification';

const MODEL = AI_MODELS.content;
const client = new Anthropic();

// "Do not retry more than once per card" — one shared retry budget covering
// BOTH failure modes (a malformed/unparseable tool-call response, or a card
// that parses fine but fails the structural consistency check). Never two
// separate retry loops stacked on top of each other.
const MAX_ATTEMPTS = 2;

const PBQ_TYPES = ['log_analysis', 'config_table', 'remediation_select'] as const;

type ArtifactType = 'log_analysis' | 'config_table';
type PbqType = ArtifactType | 'remediation_select';

interface Slot {
  type: PbqType;
  domain: string;
  objective: string;
  topicHint: string;
}

// 18 slots (6 per type), spread across domains rather than concentrated in
// Security Operations even though that's where most real PBQ content
// naturally lives — matches the spec's "spread across domains".
const SLOTS: Slot[] = [
  // log_analysis (6)
  { type: 'log_analysis', domain: 'Security Operations', objective: '4.4', topicHint: 'SIEM alert triage for anomalous authentication activity' },
  { type: 'log_analysis', domain: 'Security Operations', objective: '4.9', topicHint: 'DNS query logs showing data exfiltration via tunneling' },
  { type: 'log_analysis', domain: 'Security Operations', objective: '4.8', topicHint: 'endpoint event log timeline of a ransomware execution' },
  { type: 'log_analysis', domain: 'Security Operations', objective: '4.3', topicHint: 'firewall logs showing a reconnaissance port scan' },
  { type: 'log_analysis', domain: 'Threats, Vulnerabilities, & Mitigations', objective: '2.4', topicHint: 'proxy logs showing malware C2 beaconing' },
  { type: 'log_analysis', domain: 'Security Operations', objective: '4.6', topicHint: 'sudo/auth logs showing privilege escalation' },
  // config_table (6)
  { type: 'config_table', domain: 'Security Architecture', objective: '3.2', topicHint: 'firewall ACL rule table with a misconfigured rule' },
  { type: 'config_table', domain: 'Security Operations', objective: '4.1', topicHint: 'server hardening baseline checklist' },
  { type: 'config_table', domain: 'Security Operations', objective: '4.6', topicHint: 'file-share ACL/permissions table with a least-privilege violation' },
  { type: 'config_table', domain: 'Security Operations', objective: '4.5', topicHint: 'SPF/DKIM/DMARC DNS record table for email authentication' },
  { type: 'config_table', domain: 'Security Architecture', objective: '3.1', topicHint: 'VLAN/subnet segmentation table' },
  { type: 'config_table', domain: 'Security Operations', objective: '4.9', topicHint: 'SIEM correlation rule threshold configuration table' },
  // remediation_select (6)
  { type: 'remediation_select', domain: 'Security Operations', objective: '4.8', topicHint: 'containing a compromised endpoint mid-incident' },
  { type: 'remediation_select', domain: 'Threats, Vulnerabilities, & Mitigations', objective: '2.5', topicHint: 'remediating a newly discovered SQL injection vulnerability' },
  { type: 'remediation_select', domain: 'Security Program Management and Oversight', objective: '5.2', topicHint: 'responding to a third-party vendor data breach notification' },
  { type: 'remediation_select', domain: 'Security Architecture', objective: '3.4', topicHint: 'recovering from a failed backup during a ransomware incident' },
  { type: 'remediation_select', domain: 'General Security Concepts', objective: '1.2', topicHint: 'responding to an account takeover via credential stuffing' },
  { type: 'remediation_select', domain: 'Security Operations', objective: '4.6', topicHint: 'discovering and de-privileging an over-permissioned service account' },
];

function buildSampleSlots(): Slot[] {
  return [SLOTS.find((s) => s.type === 'log_analysis')!, SLOTS.find((s) => s.type === 'config_table')!, SLOTS.find((s) => s.type === 'remediation_select')!];
}

// Idempotency: "similar PBQ already exists for that objective+type" is
// tracked at the (objective, type) granularity — good enough to avoid
// re-covering ground a prior (possibly interrupted) run already has,
// without trying to fuzzy-match generated topics/scenarios. active AND
// pending both count as "already exists" (a card awaiting review still
// covers that slot); rejected does not (that slot is genuinely still open).
async function loadExistingPbqKeys(certificationId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ type: cards.type, objective: cards.objective })
    .from(cards)
    .where(and(eq(cards.certificationId, certificationId), inArray(cards.type, PBQ_TYPES), inArray(cards.status, ['active', 'pending'])));
  return new Set(rows.map((r) => `${r.objective}|${r.type}`));
}

function slotKey(slot: Slot): string {
  return `${slot.objective}|${slot.type}`;
}

// --- Artifact-based (log_analysis / config_table) ---

const ArtifactSchema = z.union([
  z.object({ kind: z.literal('log_lines'), lines: z.array(z.string()).min(5).max(12) }),
  z.object({ kind: z.literal('table'), columns: z.array(z.string()).min(2).max(6), rows: z.array(z.array(z.string())).min(4).max(10) }),
]);
const SubQuestionSchema = z.object({
  answerMode: z.enum(['options', 'artifact_rows']),
  question: z.string(),
  options: z.array(z.string()).optional().default([]),
  correct: z.union([z.number(), z.array(z.number())]),
  requiredCount: z.number().optional(),
  explanationByOption: z.array(z.string()),
});
const ArtifactCardSchema = z.object({
  topic: z.string(),
  scenario: z.string(),
  artifact: ArtifactSchema,
  subQuestions: z.array(SubQuestionSchema).min(2).max(4),
});
type GeneratedArtifactCard = z.infer<typeof ArtifactCardSchema>;

function artifactPbqTool(slot: Slot): Anthropic.Tool {
  const artifactKind = slot.type === 'log_analysis' ? 'log_lines' : 'table';
  return {
    name: 'submit_pbq',
    description: `Submit one ${slot.type} performance-based question.`,
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Short 2-5 word topic label' },
        scenario: { type: 'string', description: '1-3 sentences setting up the situation before the artifact' },
        artifact:
          artifactKind === 'log_lines'
            ? {
                type: 'object',
                properties: { kind: { type: 'string', enum: ['log_lines'] }, lines: { type: 'array', items: { type: 'string' }, description: '5-12 realistic raw log lines (timestamps, hostnames, real-looking values) that TOGETHER tell the scenario story — include both the relevant signal and some plausible normal/noise lines' } },
                required: ['kind', 'lines'],
              }
            : {
                type: 'object',
                properties: {
                  kind: { type: 'string', enum: ['table'] },
                  columns: { type: 'array', items: { type: 'string' }, description: '2-6 realistic column headers' },
                  rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: '4-10 rows, each with exactly one value per column, realistic values' },
                },
                required: ['kind', 'columns', 'rows'],
              },
        subQuestions: {
          type: 'array',
          description: '2-4 sub-questions graded independently against this one artifact.',
          items: {
            type: 'object',
            properties: {
              answerMode: {
                type: 'string',
                enum: ['options', 'artifact_rows'],
                description: `'options': a normal multiple-choice/select question with its own options list. 'artifact_rows': the question asks the test-taker to pick specific ${artifactKind === 'log_lines' ? 'log line(s)' : 'table row(s)'} from the artifact by index — no separate options list, correct/explanationByOption index into the artifact's own ${artifactKind === 'log_lines' ? 'lines' : 'rows'} array directly.`,
              },
              question: { type: 'string' },
              options: { type: 'array', items: { type: 'string' }, description: "Required for answerMode 'options' only — omit/empty for 'artifact_rows'." },
              correct: { description: 'Index (single-answer) or array of indices (multi-answer) — into `options` for options mode, into the artifact itself for artifact_rows mode.', oneOf: [{ type: 'integer' }, { type: 'array', items: { type: 'integer' } }] },
              requiredCount: { type: 'integer', description: 'Required when correct is a multi-entry array.' },
              explanationByOption: {
                type: 'array',
                items: { type: 'string' },
                description: `EXACTLY one entry per candidate, same order: for 'options' mode, one per entry in this sub-question's own options array; for 'artifact_rows' mode, one per entry in the artifact's OWN ${artifactKind === 'log_lines' ? 'lines' : 'rows'} array (same length as the whole artifact, not just the correct ones). Every entry non-empty, including at correct indices — this IS the "why this is right" text, not a blank.`,
              },
            },
            required: ['answerMode', 'question', 'correct', 'explanationByOption'],
          },
        },
      },
      required: ['topic', 'scenario', 'artifact', 'subQuestions'],
    },
  };
}

function buildArtifactPrompt(slot: Slot, cert: CliCertification): string {
  const artifactKind = slot.type === 'log_analysis' ? 'log_lines' : 'table';
  return `Generate one realistic ${cert.name} (${cert.examCode}) performance-based question (PBQ) of type "${slot.type}" about: ${slot.topicHint}.

This maps to objective ${slot.objective} (domain: "${slot.domain}").

ARTIFACT (${artifactKind}):
${
  artifactKind === 'log_lines'
    ? '- Write REAL-looking raw log lines (realistic timestamps, IPs, hostnames, usernames, process names) — the kind an analyst would actually see, not a paraphrase. Include both the lines relevant to the story AND a couple of plausible normal/noise lines, so identifying the relevant ones is a real skill, not just picking the only unusual-looking line.'
    : '- Build a REAL-looking configuration/data table (realistic column headers and values) that a practitioner would actually work from. Include at least one row/value that represents the issue being tested, among otherwise-correct-looking rows.'
}

SUB-QUESTIONS (2-4): each graded independently against the SAME artifact.
- Mix answerMode 'options' (a normal question with its own option list) and 'artifact_rows' (pick specific ${artifactKind === 'log_lines' ? 'log line(s)' : 'row(s)'} from the artifact by index) — use whichever fits each question, at least one of each across the sub-questions.
- If \`correct\` is an array with more than one entry, \`requiredCount\` MUST be set to that exact same length — never omit it whenever there's more than one correct answer.
- Every distractor must be a plausible, real security concept/answer — wrong only because of a specific detail in THIS scenario, never an obviously-silly option.
- explanationByOption: for 'artifact_rows' sub-questions this MUST have exactly one entry per line/row in the artifact itself (not just the correct ones) — every single line/row needs its own explanation of why it is or isn't the answer to that sub-question.

Call submit_pbq with the complete card.`;
}

// Tool-use with tool_choice is not a strict JSON-Schema validator. On this
// nested a shape, Claude has (across real runs, not hypothetical) done all
// of: nested topic/scenario/subQuestions INSIDE the artifact object instead
// of as siblings of it; sent the whole `artifact` value as a JSON-encoded
// STRING instead of a real nested object; sent `null` instead of omitting
// an optional array; and dropped topic or scenario entirely with no trace
// anywhere in the response. The first three are mechanically fixable here;
// the last is genuine content loss that a retry (see MAX_ATTEMPTS) is what
// actually handles, by asking again rather than accepting a card missing
// real content.
function normalizeArtifactInput(raw: unknown, topicFallback: string): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  let obj = { ...(raw as Record<string, unknown>) };
  obj = parseStringifiedArrayFields(obj, ['subQuestions']) as Record<string, unknown>;

  if (typeof obj.artifact === 'string') {
    try {
      obj.artifact = JSON.parse(obj.artifact);
    } catch {
      // leave as-is; will fail validation below and trigger a retry
    }
  }

  if (typeof obj.artifact === 'object' && obj.artifact !== null) {
    const a = obj.artifact as Record<string, unknown>;
    for (const key of ['topic', 'scenario', 'subQuestions']) {
      if (obj[key] === undefined && a[key] !== undefined) obj[key] = a[key];
    }
    obj.artifact = { kind: a.kind, lines: a.lines, columns: a.columns, rows: a.rows };
  }

  if (Array.isArray(obj.subQuestions)) {
    obj.subQuestions = obj.subQuestions.map((sq) => {
      if (typeof sq !== 'object' || sq === null) return sq;
      const s = { ...(sq as Record<string, unknown>) };
      if (s.explanationByOption === null || s.explanationByOption === undefined) s.explanationByOption = [];
      if (s.options === null) s.options = [];
      return s;
    });
  }

  // `topic` is just a display label, never graded content — safe to fall
  // back on the slot's own hint rather than burning the one retry purely to
  // get a label filled in.
  if (typeof obj.topic !== 'string' || obj.topic.trim() === '') obj.topic = topicFallback;

  return obj;
}

// Same JSON-stringified-field quirk observed on `artifact` also hits plain
// array fields sometimes (e.g. remediation_select's `actions` arriving as
// a JSON string instead of a real array) — parse any of the named fields
// that came back as a string before validating.
function parseStringifiedArrayFields(raw: unknown, fields: string[]): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  for (const field of fields) {
    if (typeof obj[field] === 'string') {
      try {
        obj[field] = JSON.parse(obj[field] as string);
      } catch {
        // leave as-is; will fail validation and trigger a retry
      }
    }
  }
  return obj;
}

// Observed on real generations: the model occasionally over-escapes an
// embedded quote inside a string value (writes \" where a properly-JSON-
// encoded string would just have "), which survives JSON parsing as a
// literal backslash-quote pair rather than a real quote character. Cheap,
// safe cleanup applied recursively to every string in the generated
// object before it's shuffled, printed, or persisted.
function unescapeStrayQuotes<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/\\"/g, '"') as unknown as T;
  if (Array.isArray(value)) return value.map((v) => unescapeStrayQuotes(v)) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = unescapeStrayQuotes(v);
    return out as T;
  }
  return value;
}

// Shuffles one indexed pool (a sub-question's own `options`, or
// remediation_select's `actions`) so the correct answer doesn't
// systematically land wherever the model habitually writes it — the exact
// position-leak concern src/lib/option-order.ts's own doc comment
// documents (~62% index-0 bias observed on un-shuffled generated content).
// Reuses that module's Fisher-Yates + remap primitives rather than
// reimplementing them; only the field name differs here (`explanationByOption`
// instead of `distractorExplanations`, and required for every entry, not
// just distractors), so its own `shuffleChoiceContent` wrapper doesn't
// directly fit.
function shuffleIndexedPool(
  options: string[],
  correct: number | number[],
  explanationByOption: string[]
): { options: string[]; correct: number | number[]; explanationByOption: string[] } {
  const order = randomOrder(options.length);
  const newIndexOf = invertOrder(order);
  return {
    options: applyOrder(options, order),
    correct: Array.isArray(correct) ? correct.map((i) => newIndexOf[i]) : newIndexOf[correct],
    explanationByOption: applyOrder(explanationByOption, order),
  };
}

// Deliberately does NOT touch 'artifact_rows' sub-questions — their pool is
// the artifact's own lines/rows (a log dump or config table), which is
// scenario content with its own authored/chronological order, not a
// multiple-choice option list to scramble.
function shuffleArtifactCard(card: GeneratedArtifactCard): GeneratedArtifactCard {
  return {
    ...card,
    subQuestions: card.subQuestions.map((sq) => {
      if (sq.answerMode !== 'options') return sq;
      const shuffled = shuffleIndexedPool(sq.options, sq.correct, sq.explanationByOption);
      return { ...sq, options: shuffled.options, correct: shuffled.correct, explanationByOption: shuffled.explanationByOption };
    }),
  };
}

function toArtifactPbqContent(card: GeneratedArtifactCard): ArtifactPbqContent {
  return {
    scenario: card.scenario,
    artifact: card.artifact,
    subQuestions: card.subQuestions.map((sq) => ({
      answerMode: sq.answerMode,
      question: sq.question,
      ...(sq.answerMode === 'options' ? { options: sq.options } : {}),
      correct: sq.correct,
      ...(sq.requiredCount !== undefined ? { requiredCount: sq.requiredCount } : {}),
      explanationByOption: sq.explanationByOption,
    })) as ArtifactPbqContent['subQuestions'],
  };
}

async function requestArtifactCard(slot: Slot, cert: CliCertification): Promise<GeneratedArtifactCard | null> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    tools: [artifactPbqTool(slot)],
    tool_choice: { type: 'tool', name: 'submit_pbq' },
    messages: [{ role: 'user', content: buildArtifactPrompt(slot, cert) }],
  });
  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) return null;
  if (process.env.PBQ_DEBUG) console.log('stop_reason:', response.stop_reason, '\nRAW:', JSON.stringify(toolUse.input, null, 2));
  const topicFallback = slot.topicHint.length > 40 ? `${slot.topicHint.slice(0, 40)}...` : slot.topicHint;
  const parsed = ArtifactCardSchema.safeParse(normalizeArtifactInput(toolUse.input, topicFallback));
  if (!parsed.success) {
    console.log(`  Malformed response (${parsed.error.issues.map((i) => i.path.join('.')).join(', ')})`);
    return null;
  }
  return parsed.data;
}

async function generateArtifactCardChecked(
  slot: Slot,
  cert: CliCertification
): Promise<{ card: GeneratedArtifactCard; content: ArtifactPbqContent; issues: string[] } | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = await requestArtifactCard(slot, cert);
    if (!raw) {
      if (attempt < MAX_ATTEMPTS) console.log(`  Attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying once...`);
      continue;
    }
    const card = shuffleArtifactCard(unescapeStrayQuotes(raw));
    const content = toArtifactPbqContent(card);
    const issues = checkArtifactPbqConsistency(content);
    if (issues.length === 0 || attempt === MAX_ATTEMPTS) return { card, content, issues };
    console.log(`  Attempt ${attempt}/${MAX_ATTEMPTS} failed structural check (${issues.join('; ')}), retrying once...`);
  }
  return null;
}

// --- remediation_select ---

const RemediationCardSchema = z.object({
  topic: z.string(),
  scenario: z.string(),
  question: z.string(),
  actions: z.array(z.string()).min(4).max(8),
  correctActions: z.array(z.number()).min(1),
  explanationByOption: z.array(z.string()),
});
type GeneratedRemediationCard = z.infer<typeof RemediationCardSchema>;

const remediationTool: Anthropic.Tool = {
  name: 'submit_pbq',
  description: 'Submit one remediation_select performance-based question.',
  input_schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Short 2-5 word topic label' },
      scenario: { type: 'string', description: '2-4 sentences describing an incident/situation requiring a response' },
      question: { type: 'string', description: 'e.g. "Select the actions the analyst should take to remediate this incident."' },
      actions: { type: 'array', items: { type: 'string' }, description: '4-8 candidate remediation actions — a realistic mix of correct/needed steps and plausible-but-wrong ones (wrong scope, wrong order, unnecessary, or actively harmful).' },
      correctActions: { type: 'array', items: { type: 'integer' }, description: 'Indices of every action that IS correct/needed — at least 1, typically 2-4.' },
      explanationByOption: { type: 'array', items: { type: 'string' }, description: 'EXACTLY one entry per action, same order — including correct ones (this IS the "why this is right/needed" text, never blank).' },
    },
    required: ['topic', 'scenario', 'question', 'actions', 'correctActions', 'explanationByOption'],
  },
};

function buildRemediationPrompt(slot: Slot, cert: CliCertification): string {
  return `Generate one realistic ${cert.name} (${cert.examCode}) remediation_select performance-based question about: ${slot.topicHint}.

This maps to objective ${slot.objective} (domain: "${slot.domain}").

- Write a real incident/situation scenario (2-4 sentences) that requires the test-taker to choose which of several candidate actions are actually correct/needed.
- 4-8 candidate actions: a realistic mix — some genuinely correct/needed, others plausible but wrong (wrong scope, wrong timing/order, unnecessary given the scenario, or actively counterproductive). Never an obviously-silly option.
- Every action gets its own explanation, including correct ones — explain WHY it's needed or WHY it's wrong for this specific scenario.

Call submit_pbq with the complete card.`;
}

function shuffleRemediationCard(card: GeneratedRemediationCard): GeneratedRemediationCard {
  const shuffled = shuffleIndexedPool(card.actions, card.correctActions, card.explanationByOption);
  return { ...card, actions: shuffled.options, correctActions: shuffled.correct as number[], explanationByOption: shuffled.explanationByOption };
}

function toRemediationContent(card: GeneratedRemediationCard): RemediationSelectContent {
  return {
    scenario: card.scenario,
    question: card.question,
    actions: card.actions,
    correctActions: card.correctActions,
    explanationByOption: card.explanationByOption,
  };
}

async function requestRemediationCard(slot: Slot, cert: CliCertification): Promise<GeneratedRemediationCard | null> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    tools: [remediationTool],
    tool_choice: { type: 'tool', name: 'submit_pbq' },
    messages: [{ role: 'user', content: buildRemediationPrompt(slot, cert) }],
  });
  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) return null;
  const input = parseStringifiedArrayFields(toolUse.input, ['actions', 'correctActions', 'explanationByOption']) as Record<string, unknown>;
  if (typeof input.topic !== 'string' || input.topic.trim() === '') {
    input.topic = slot.topicHint.length > 40 ? `${slot.topicHint.slice(0, 40)}...` : slot.topicHint;
  }
  const parsed = RemediationCardSchema.safeParse(input);
  if (!parsed.success) {
    console.log(`  Malformed response (${parsed.error.issues.map((i) => i.path.join('.')).join(', ')})`);
    return null;
  }
  return parsed.data;
}

async function generateRemediationCardChecked(
  slot: Slot,
  cert: CliCertification
): Promise<{ card: GeneratedRemediationCard; content: RemediationSelectContent; issues: string[] } | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = await requestRemediationCard(slot, cert);
    if (!raw) {
      if (attempt < MAX_ATTEMPTS) console.log(`  Attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying once...`);
      continue;
    }
    const card = shuffleRemediationCard(unescapeStrayQuotes(raw));
    const content = toRemediationContent(card);
    const issues = checkRemediationConsistency(content);
    if (issues.length === 0 || attempt === MAX_ATTEMPTS) return { card, content, issues };
    console.log(`  Attempt ${attempt}/${MAX_ATTEMPTS} failed structural check (${issues.join('; ')}), retrying once...`);
  }
  return null;
}

// --- shared ---

function printArtifactCard(slot: Slot, card: GeneratedArtifactCard, issues: string[]) {
  console.log(`\n--- [${slot.domain}] ${card.topic} (obj ${slot.objective}, ${slot.type})`);
  console.log(`Scenario: ${card.scenario}`);
  if (card.artifact.kind === 'log_lines') {
    console.log('Log lines:');
    card.artifact.lines.forEach((l, i) => console.log(`  [${i}] ${l}`));
  } else {
    console.log('Table:', card.artifact.columns.join(' | '));
    card.artifact.rows.forEach((r, i) => console.log(`  [${i}] ${r.join(' | ')}`));
  }
  card.subQuestions.forEach((sq, i) => {
    console.log(`  Sub-Q${i + 1} (${sq.answerMode}): ${sq.question}`);
    if (sq.answerMode === 'options') sq.options.forEach((o, j) => console.log(`    ${j}: ${o}`));
    console.log(`    correct: ${JSON.stringify(sq.correct)}`);
  });
  if (issues.length > 0) console.log('STRUCTURAL ISSUES:', issues.join('; '));
}

function printRemediationCard(slot: Slot, card: GeneratedRemediationCard, issues: string[]) {
  console.log(`\n--- [${slot.domain}] ${card.topic} (obj ${slot.objective}, remediation_select)`);
  console.log(`Scenario: ${card.scenario}`);
  console.log(`Q: ${card.question}`);
  card.actions.forEach((a, i) => console.log(`  ${i} ${card.correctActions.includes(i) ? '(correct)' : '(wrong)'}: ${a}`));
  if (issues.length > 0) console.log('STRUCTURAL ISSUES:', issues.join('; '));
}

function printDryRunPlan(toGenerate: Slot[], skipped: Slot[]) {
  console.log('=== DRY RUN — nothing will be generated or written ===\n');

  for (const type of PBQ_TYPES) {
    const slotsForType = toGenerate.filter((s) => s.type === type);
    console.log(`${type}: ${slotsForType.length} to generate`);
    for (const s of slotsForType) {
      console.log(`  [${s.domain}] obj ${s.objective} — ${s.topicHint}`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped (already have a card for that objective+type): ${skipped.length}`);
    for (const s of skipped) console.log(`  [${s.type}] obj ${s.objective} — ${s.topicHint}`);
  }

  console.log(`\nTotal to generate: ${toGenerate.length}`);
  console.log(`Estimated AI calls: ${toGenerate.length}-${toGenerate.length * MAX_ATTEMPTS} (1 per card, up to ${MAX_ATTEMPTS} if a retry is needed)`);
}

async function main() {
  const sampleArg = process.argv.includes('--sample');
  const dryRunArg = process.argv.includes('--dry-run');
  const certificationId = parseCertificationIdArg();
  const cert = await resolveCliCertification(certificationId);
  requireSy0701(cert, 'generate-pbq-cards.ts');
  console.log(`Target certification: ${cert.name} (${cert.examCode})`);

  const existingKeys = await loadExistingPbqKeys(cert.id);
  const toGenerate = SLOTS.filter((s) => !existingKeys.has(slotKey(s)));
  const skipped = SLOTS.filter((s) => existingKeys.has(slotKey(s)));

  if (dryRunArg) {
    printDryRunPlan(toGenerate, skipped);
    return;
  }

  const slots = sampleArg ? buildSampleSlots() : toGenerate;
  console.log(`Generating ${slots.length} PBQ card(s)${sampleArg ? ' (SAMPLE — not written to DB)' : ''}${!sampleArg && skipped.length > 0 ? ` (${skipped.length} slot(s) skipped — already covered)` : ''}...`);

  const db = getDb();
  const user = await getCurrentUser();
  let activeCount = 0;
  let pendingCount = 0;
  let failedCount = 0;

  for (const [i, slot] of slots.entries()) {
    console.log(`\n[${i + 1}/${slots.length}] ${slot.type} — ${slot.topicHint}`);

    if (slot.type === 'remediation_select') {
      const result = await generateRemediationCardChecked(slot, cert);
      if (!result) {
        console.log('  FAILED — no usable response after retry, skipping this slot.');
        failedCount++;
        continue;
      }
      if (sampleArg) {
        printRemediationCard(slot, result.card, result.issues);
        continue;
      }
      const status = result.issues.length === 0 ? 'active' : 'pending';
      await db.insert(cards).values({
        userId: user.id,
        certificationId: cert.id,
        domain: slot.domain,
        topic: result.card.topic,
        type: 'remediation_select',
        content: result.content,
        status,
        sourceType: 'generated',
        objective: slot.objective,
      });
      status === 'active' ? activeCount++ : pendingCount++;
      if (status !== 'active') console.log('  Held for review:', result.issues.join('; '));
    } else {
      const result = await generateArtifactCardChecked(slot, cert);
      if (!result) {
        console.log('  FAILED — no usable response after retry, skipping this slot.');
        failedCount++;
        continue;
      }
      if (sampleArg) {
        printArtifactCard(slot, result.card, result.issues);
        continue;
      }
      const status = result.issues.length === 0 ? 'active' : 'pending';
      await db.insert(cards).values({
        userId: user.id,
        certificationId: cert.id,
        domain: slot.domain,
        topic: result.card.topic,
        type: slot.type,
        content: result.content,
        status,
        sourceType: 'generated',
        objective: slot.objective,
      });
      status === 'active' ? activeCount++ : pendingCount++;
      if (status !== 'active') console.log('  Held for review:', result.issues.join('; '));
    }
  }

  if (sampleArg) {
    console.log('\nSample complete — nothing written to the database.');
  } else {
    console.log(`\nInserted ${activeCount} active card(s), ${pendingCount} held as pending on structural check, ${failedCount} failed entirely.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
