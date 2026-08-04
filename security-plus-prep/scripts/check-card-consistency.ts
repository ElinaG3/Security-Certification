// Structural consistency check for generated card content. This is a
// programmatic/deterministic check only — array lengths, index ranges,
// non-empty fields, "(Choose N)" count matching. It CANNOT catch semantic
// misalignment (an explanation whose text doesn't actually match its
// option, like the bug found in the 8-card sample) — that needs a human
// read, which is what the random-sample step below is for.
//
// Usage: npx dotenv-cli -e .env.local -e .env -- tsx scripts/check-card-consistency.ts

import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import type { MultipleChoiceContent, MultipleSelectContent } from '../src/db/question-types';

type Content = MultipleChoiceContent | MultipleSelectContent;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
};

export function checkCardConsistency(content: Content, type: string): string[] {
  const issues: string[] = [];
  const correctIndices = Array.isArray(content.correct) ? content.correct : [content.correct];

  for (const idx of correctIndices) {
    if (idx < 0 || idx >= content.options.length) {
      issues.push(`correct index ${idx} out of range (${content.options.length} options)`);
    }
  }

  const seen = new Set<string>();
  content.options.forEach((opt) => {
    const key = opt.trim().toLowerCase();
    if (seen.has(key)) issues.push(`duplicate option: "${opt}"`);
    seen.add(key);
  });

  const de = content.distractorExplanations;
  if (!de) {
    issues.push('missing distractorExplanations array');
  } else {
    if (de.length !== content.options.length) {
      issues.push(`distractorExplanations length ${de.length} !== options length ${content.options.length}`);
    }
    content.options.forEach((_, idx) => {
      const isCorrect = correctIndices.includes(idx);
      const text = de[idx];
      if (isCorrect) {
        if (text && text.trim() !== '') {
          issues.push(`correct option ${idx} has a non-empty distractorExplanation (should be empty)`);
        }
      } else if (!text || text.trim() === '') {
        issues.push(`wrong option ${idx} has an empty/missing distractorExplanation`);
      }
    });
  }

  if (type === 'multiple_select') {
    const ms = content as MultipleSelectContent;
    const match = ms.question.match(/\(Choose (\w+)\.?\)/i);
    if (!match) {
      issues.push('multiple_select question missing "(Choose N.)" phrasing');
    } else {
      const n = NUMBER_WORDS[match[1].toLowerCase()];
      if (n === undefined) {
        issues.push(`could not parse "(Choose ${match[1]})" as a count`);
      } else {
        if (n !== correctIndices.length) {
          issues.push(`"(Choose ${match[1]})" says ${n} but correct[] has ${correctIndices.length} entries`);
        }
        if (ms.requiredCount !== n) {
          issues.push(`requiredCount (${ms.requiredCount}) doesn't match "(Choose ${match[1]})" (${n})`);
        }
      }
    }
  }

  return issues;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function printCardFull(card: { domain: string; topic: string; objective: string | null; authoredDifficulty: string | null; type: string; content: unknown }) {
  const content = card.content as Content;
  const correctIndices = Array.isArray(content.correct) ? content.correct : [content.correct];
  console.log(`\n--- [${card.domain}] ${card.topic}${card.objective ? ` (obj ${card.objective})` : ''}${card.authoredDifficulty ? `, ${card.authoredDifficulty}` : ''}, ${card.type}`);
  console.log(`Q: ${content.question}`);
  content.options.forEach((opt, idx) => {
    const marker = correctIndices.includes(idx) ? '(correct)' : '(wrong)';
    console.log(`  ${idx} ${marker}: ${opt}`);
    if (!correctIndices.includes(idx)) {
      console.log(`     -> ${content.distractorExplanations?.[idx] ?? '(missing)'}`);
    }
  });
  console.log(`Explanation: ${content.explanation}`);
}

async function main() {
  const db = getDb();

  console.log('=== A. New pending cards — structural consistency check ===');
  const pending = await db.select().from(cards).where(eq(cards.status, 'pending'));
  console.log(`Checking ${pending.length} pending card(s)...\n`);

  const flagged: { id: string; label: string; issues: string[] }[] = [];
  const passing: typeof pending = [];

  for (const card of pending) {
    const content = card.content as Content;
    const issues = checkCardConsistency(content, card.type);
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

  console.log('\n=== B. 20 random passing cards — read these for semantic issues ===');
  const sample = shuffle(passing).slice(0, 20);
  for (const card of sample) printCardFull(card);

  console.log('\n=== C. Legacy 135 cards — retroactive check (report only, no status change) ===');
  const legacy = await db.select().from(cards).where(eq(cards.status, 'active'));
  const legacyFlagged: { label: string; issues: string[] }[] = [];
  for (const card of legacy) {
    const content = card.content as Content;
    const issues = checkCardConsistency(content, card.type);
    if (issues.length > 0) legacyFlagged.push({ label: `${card.domain} — ${card.topic}`, issues });
  }
  console.log(`Checked ${legacy.length} active cards. Failed: ${legacyFlagged.length}\n`);
  for (const f of legacyFlagged) {
    console.log(`  [${f.label}]`);
    for (const issue of f.issues) console.log(`    - ${issue}`);
  }
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
