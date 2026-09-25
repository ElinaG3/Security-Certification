// Structural consistency check for generated card content. This is a
// programmatic/deterministic check only — array lengths, index ranges,
// non-empty fields, "(Choose N)" count matching. It CANNOT catch semantic
// misalignment (an explanation whose text doesn't actually match its
// option, like the bug found in the 8-card sample) — that needs a human
// read, which is what the random-sample step below is for.
//
// Usage: npx dotenv-cli -e .env -- tsx scripts/check-card-consistency.ts

import { writeFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import { checkCardConsistency } from '../src/lib/card-consistency';
import type {
  MultipleChoiceContent,
  MultipleSelectContent,
  ArtifactPbqContent,
  RemediationSelectContent,
  PbqArtifact,
  PbqSubQuestion,
} from '../src/db/question-types';

type Content = MultipleChoiceContent | MultipleSelectContent;

// Re-exported for the scripts that already import it from here
// (repair-rejected-cards.ts, rewrite-legacy-cards.ts, etc.) — the
// implementation itself now lives in src/lib/card-consistency.ts so the
// app (app/create/actions.ts) can share it too, instead of forking a copy.
export { checkCardConsistency };

// Structural check for a single sub-question against whatever pool of
// options/explanations it grades against (its own `options`, or the
// artifact's lines/rows). Shared by both answerMode cases that resolve to
// an indexed pool ('options' and 'artifact_rows') — 'cell_value' has its
// own shape and is checked separately below.
function checkExplanationPool(
  poolSize: number,
  correctIndices: number[],
  explanationByOption: string[],
  label: string
): string[] {
  const issues: string[] = [];

  for (const idx of correctIndices) {
    if (idx < 0 || idx >= poolSize) {
      issues.push(`${label}: correct index ${idx} out of range (${poolSize} entries)`);
    }
  }
  if (correctIndices.length === 0) {
    issues.push(`${label}: no correct indices — a PBQ with zero right answers is a broken card`);
  }

  if (explanationByOption.length !== poolSize) {
    issues.push(`${label}: explanationByOption length ${explanationByOption.length} !== pool size ${poolSize}`);
  }
  explanationByOption.forEach((text, idx) => {
    if (!text || text.trim() === '') {
      issues.push(`${label}: entry ${idx} has an empty/missing explanation — every option requires one, including correct ones`);
    }
  });

  return issues;
}

function checkSubQuestion(sq: PbqSubQuestion, artifact: PbqArtifact, index: number): string[] {
  const issues: string[] = [];
  const label = `sub-question ${index}`;

  if (sq.answerMode === 'options') {
    const correctIndices = Array.isArray(sq.correct) ? sq.correct : [sq.correct];
    issues.push(...checkExplanationPool(sq.options.length, correctIndices, sq.explanationByOption, label));
    if (Array.isArray(sq.correct) && sq.correct.length > 1 && sq.requiredCount !== sq.correct.length) {
      issues.push(`${label}: requiredCount (${sq.requiredCount}) doesn't match correct[] length (${sq.correct.length})`);
    }
  } else if (sq.answerMode === 'artifact_rows') {
    const pool = artifact.kind === 'log_lines' ? artifact.lines : artifact.rows;
    const correctIndices = Array.isArray(sq.correct) ? sq.correct : [sq.correct];
    issues.push(...checkExplanationPool(pool.length, correctIndices, sq.explanationByOption, label));
    if (Array.isArray(sq.correct) && sq.correct.length > 1 && sq.requiredCount !== sq.correct.length) {
      issues.push(`${label}: requiredCount (${sq.requiredCount}) doesn't match correct[] length (${sq.correct.length})`);
    }
  } else {
    // cell_value
    if (artifact.kind !== 'table') {
      issues.push(`${label}: answerMode 'cell_value' requires a table artifact`);
      return issues;
    }
    if (!artifact.columns.includes(sq.column)) {
      issues.push(`${label}: column "${sq.column}" not found in artifact columns`);
    }
    sq.rows.forEach((row) => {
      if (row < 0 || row >= artifact.rows.length) {
        issues.push(`${label}: row index ${row} out of range (${artifact.rows.length} rows)`);
      }
    });
    if (sq.correct.length !== sq.rows.length) {
      issues.push(`${label}: correct[] length ${sq.correct.length} !== rows[] length ${sq.rows.length}`);
    }
    issues.push(...checkExplanationPool(sq.options.length, sq.correct, sq.explanationByOption, label));
  }

  return issues;
}

export function checkArtifactPbqConsistency(content: ArtifactPbqContent): string[] {
  const issues: string[] = [];

  if (content.artifact.kind === 'log_lines' && content.artifact.lines.length === 0) {
    issues.push('artifact: log_lines is empty');
  }
  if (content.artifact.kind === 'table') {
    const artifact = content.artifact;
    if (artifact.columns.length === 0) issues.push('artifact: table has no columns');
    artifact.rows.forEach((row, i) => {
      if (row.length !== artifact.columns.length) {
        issues.push(`artifact: row ${i} has ${row.length} cells, expected ${artifact.columns.length}`);
      }
    });
  }

  if (content.subQuestions.length < 2 || content.subQuestions.length > 4) {
    issues.push(`subQuestions length ${content.subQuestions.length} — expected 2-4`);
  }

  content.subQuestions.forEach((sq, i) => {
    issues.push(...checkSubQuestion(sq, content.artifact, i));
  });

  return issues;
}

export function checkRemediationConsistency(content: RemediationSelectContent): string[] {
  const issues: string[] = [];

  if (content.actions.length === 0) {
    issues.push('actions is empty');
  }

  const seen = new Set<string>();
  content.actions.forEach((action) => {
    const key = action.trim().toLowerCase();
    if (seen.has(key)) issues.push(`duplicate action: "${action}"`);
    seen.add(key);
  });

  issues.push(...checkExplanationPool(content.actions.length, content.correctActions, content.explanationByOption, 'remediation_select'));

  return issues;
}

// Routes to the right checker by card type. Phase 4's generate-cards.ts
// extension will produce pending log_analysis/config_table/remediation_select
// cards too, so main()'s pending/legacy loops need this dispatch to stay
// correct once that lands — not just for the hand-seeded PBQ cards, which
// go straight to 'active' via scripts/seed-pbq-cards.ts today.
function checkAnyCardConsistency(content: unknown, type: string): string[] {
  if (type === 'log_analysis' || type === 'config_table') {
    return checkArtifactPbqConsistency(content as ArtifactPbqContent);
  }
  if (type === 'remediation_select') {
    return checkRemediationConsistency(content as RemediationSelectContent);
  }
  return checkCardConsistency(content as Content, type);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatCardFull(card: { domain: string; topic: string; objective: string | null; authoredDifficulty: string | null; type: string; content: unknown }): string {
  const content = card.content as Content;
  const correctIndices = Array.isArray(content.correct) ? content.correct : [content.correct];
  const lines: string[] = [];
  lines.push(`\n--- [${card.domain}] ${card.topic}${card.objective ? ` (obj ${card.objective})` : ''}${card.authoredDifficulty ? `, ${card.authoredDifficulty}` : ''}, ${card.type}`);
  lines.push(`Q: ${content.question}`);
  content.options.forEach((opt, idx) => {
    const marker = correctIndices.includes(idx) ? '(correct)' : '(wrong)';
    lines.push(`  ${idx} ${marker}: ${opt}`);
    if (!correctIndices.includes(idx)) {
      lines.push(`     -> ${content.distractorExplanations?.[idx] ?? '(missing)'}`);
    }
  });
  lines.push(`Explanation: ${content.explanation}`);
  return lines.join('\n');
}

// Writes a random-sample dump of MC/MS cards to a file for manual semantic
// review (the structural check can't catch an explanation that doesn't
// actually match its option — that needs a human read). Shared by section B
// (new pending cards -> samples-new.txt) and section C (legacy/seeded
// active cards -> samples-legacy.txt).
function writeSampleFile(path: string, header: string, sampleCards: (typeof cards.$inferSelect)[]): number {
  const mcMsCards = sampleCards.filter((c) => c.type === 'multiple_choice' || c.type === 'multiple_select');
  const sample = shuffle(mcMsCards).slice(0, 20);
  const text = [header, ...sample.map(formatCardFull)].join('\n');
  writeFileSync(path, text + '\n');
  return sample.length;
}

async function main() {
  const db = getDb();

  console.log('=== A. New pending cards — structural consistency check ===');
  const pending = await db.select().from(cards).where(eq(cards.status, 'pending'));
  console.log(`Checking ${pending.length} pending card(s)...\n`);

  const flagged: { id: string; label: string; issues: string[] }[] = [];
  const passing: typeof pending = [];

  for (const card of pending) {
    const issues = checkAnyCardConsistency(card.content, card.type);
    const label = `${card.domain} — ${card.topic}`;
    if (issues.length > 0) {
      flagged.push({ id: card.id, label, issues });
    } else {
      passing.push(card);
    }
  }

  if (flagged.length > 0) {
    console.log(`Auto-rejecting ${flagged.length} card(s) that failed the structural check:\n`);
    for (const f of flagged) {
      console.log(`  [${f.label}]`);
      for (const issue of f.issues) console.log(`    - ${issue}`);
      await db.update(cards).set({ status: 'rejected' }).where(eq(cards.id, f.id));
    }
  } else {
    console.log('No structural issues found.');
  }
  console.log(`\nPassing structural check: ${passing.length} / ${pending.length}`);

  // formatCardFull only knows the MC/MS shape — fine today since pending
  // cards are only ever generate-cards.ts output (MC/MS); Phase 4's PBQ
  // generation will need its own formatter here.
  const newCount = writeSampleFile(
    'samples-new.txt',
    '=== B. 20 random passing cards — read these for semantic issues ===',
    passing
  );
  console.log(`\nWrote ${newCount} sample(s) to samples-new.txt for semantic review.`);

  console.log('\n=== C. Legacy + seeded cards — retroactive check (report only, no status change) ===');
  const legacy = await db.select().from(cards).where(eq(cards.status, 'active'));
  const legacyFlagged: { label: string; issues: string[] }[] = [];
  for (const card of legacy) {
    const issues = checkAnyCardConsistency(card.content, card.type);
    if (issues.length > 0) legacyFlagged.push({ label: `${card.domain} — ${card.topic}`, issues });
  }
  console.log(`Checked ${legacy.length} active cards. Failed: ${legacyFlagged.length}\n`);
  for (const f of legacyFlagged) {
    console.log(`  [${f.label}]`);
    for (const issue of f.issues) console.log(`    - ${issue}`);
  }

  const legacyCount = writeSampleFile(
    'samples-legacy.txt',
    '=== C2. 20 random legacy/seeded cards — read these for semantic issues ===',
    legacy
  );
  console.log(`\nWrote ${legacyCount} sample(s) to samples-legacy.txt for semantic review.`);
}

// Only run the CLI when this file is executed directly — importing
// `checkCardConsistency` from another script (e.g. repair-rejected-cards.ts)
// must not also trigger this file's own main() + process.exit().
const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
