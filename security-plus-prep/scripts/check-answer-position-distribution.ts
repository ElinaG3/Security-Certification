// Reports how often the correct answer lands at each option position, across
// all active multiple_choice/multiple_select cards, as STORED (not as
// displayed). This is now a generator-health check, not a live-leak
// indicator: src/lib/question-public.ts re-shuffles option order on every
// render regardless of storage order, so a skew here no longer reaches the
// user. It still matters because src/lib/card-generation.ts and the batch
// generation scripts (scripts/generate-cards.ts, generate-gsc-cards.ts,
// rewrite-legacy-cards.ts, ingest-pdf.ts) now shuffle each draft
// programmatically before it's ever written to the DB — this script is how
// you'd notice if that shuffle step regressed (e.g. someone bypasses
// shuffleChoiceContent when adding a new generation path).
//
// Cards predating this fix will still show historical skew here (never
// migrated — display-time shuffle made that unnecessary); that's expected,
// not a bug. What matters is whether NEWLY generated cards land uniform.
//
// Usage: npx dotenv-cli -- tsx scripts/check-answer-position-distribution.ts

import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import type { MultipleChoiceContent, MultipleSelectContent } from '../src/db/question-types';

async function main() {
  const db = getDb();

  const rows = await db
    .select()
    .from(cards)
    .where(and(eq(cards.status, 'active'), inArray(cards.type, ['multiple_choice', 'multiple_select'])));

  const positionCounts = new Map<number, number>();
  let totalCorrectSlots = 0;

  for (const row of rows) {
    const content = row.content as MultipleChoiceContent | MultipleSelectContent;
    const correctIndices = Array.isArray(content.correct) ? content.correct : [content.correct];
    for (const idx of correctIndices) {
      positionCounts.set(idx, (positionCounts.get(idx) ?? 0) + 1);
      totalCorrectSlots += 1;
    }
  }

  console.log(`Active multiple_choice/multiple_select cards: ${rows.length}`);
  console.log(`Total correct-answer slots counted: ${totalCorrectSlots}\n`);

  const maxIdx = Math.max(0, ...positionCounts.keys());
  console.log('Position | Count | Share');
  console.log('---------|-------|------');
  for (let i = 0; i <= maxIdx; i++) {
    const count = positionCounts.get(i) ?? 0;
    const share = totalCorrectSlots > 0 ? ((count / totalCorrectSlots) * 100).toFixed(1) : '0.0';
    console.log(`${i}        | ${count}   | ${share}%`);
  }

  const expected = totalCorrectSlots / (maxIdx + 1);
  const worstDeviation = Math.max(
    ...Array.from({ length: maxIdx + 1 }, (_, i) => Math.abs((positionCounts.get(i) ?? 0) - expected))
  );
  const skewed = worstDeviation / expected > 0.25; // >25% off uniform on any position

  console.log(`\nExpected count per position if uniform: ~${expected.toFixed(1)}`);
  console.log(skewed ? 'SKEWED — position leaks the answer.' : 'Roughly uniform — position does not leak the answer.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
