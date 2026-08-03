// Ground-truth audit of the DB + codebase. Re-run any time with:
//   npx dotenv-cli -e .env.local -e .env -- tsx scripts/audit-cards.ts
// Queries and greps only — never trust a prior session's summary of what
// shipped over what's actually in the database and the code.

import { execSync } from 'node:child_process';
import { neon } from '@neondatabase/serverless';
import { getDb } from '../src/db';
import { cards, explanationSuggestions, reviewLog } from '../src/db/schema';
import { sql, eq, gte } from 'drizzle-orm';
import type { MultipleChoiceContent, MultipleSelectContent } from '../src/db/question-types';

const sqlClient = neon(process.env.DATABASE_URL!);
const db = getDb();

function pct(n: number, total: number): string {
  return total === 0 ? '0.0%' : `${((n / total) * 100).toFixed(1)}%`;
}

async function domainBalance() {
  console.log('\n=== 1. Domain balance ===');

  const rows = await db
    .select({ domain: cards.domain, count: sql<number>`count(*)::int` })
    .from(cards)
    .groupBy(cards.domain);

  const total = rows.reduce((sum, r) => sum + r.count, 0);

  // Official SY0-701 exam objective weights. Mapping is by name — flagged
  // explicitly where the DB's domain string doesn't exactly match the
  // official objective name, rather than silently assuming equivalence.
  const official: Record<string, number> = {
    'Security Operations': 28,
    'Threats, Vulnerabilities, & Mitigations': 22,
    'Security Program Management & Oversight': 20,
    'Security Architecture': 18,
    'General Security Concepts': 12,
  };

  console.log(`Total cards: ${total}\n`);
  console.log('Domain'.padEnd(45), 'Count'.padEnd(8), 'Actual%'.padEnd(10), 'Target%'.padEnd(10), 'Diff', 'Flag');

  const seenOfficial = new Set<string>();
  for (const r of rows) {
    const actualPct = total === 0 ? 0 : (r.count / total) * 100;
    const target = official[r.domain];
    if (target !== undefined) seenOfficial.add(r.domain);
    const diff = target !== undefined ? actualPct - target : null;
    const flag = diff !== null && Math.abs(diff) > 4 ? 'FLAG >4pp off' : target === undefined ? 'NAME MISMATCH — not an official objective name' : '';
    console.log(
      r.domain.padEnd(45),
      String(r.count).padEnd(8),
      `${actualPct.toFixed(1)}%`.padEnd(10),
      (target !== undefined ? `${target}%` : 'n/a').padEnd(10),
      diff !== null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}pp` : 'n/a',
      flag
    );
  }

  const missingOfficial = Object.keys(official).filter((name) => !seenOfficial.has(name));
  if (missingOfficial.length > 0) {
    console.log(`\nOfficial objectives with NO exact-name match in the DB: ${missingOfficial.join(', ')}`);
  }
}

async function questionTypeMix() {
  console.log('\n=== 2. Question type mix ===');

  const rows = await db
    .select({ type: cards.type, count: sql<number>`count(*)::int` })
    .from(cards)
    .groupBy(cards.type);

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  console.log(`Total cards: ${total}\n`);
  for (const r of rows) {
    console.log(`  ${r.type.padEnd(20)} ${String(r.count).padEnd(6)} ${pct(r.count, total)}`);
  }

  const msCount = rows.find((r) => r.type === 'multiple_select')?.count ?? 0;
  console.log(`\nmultiple_select share: ${pct(msCount, total)} (target: ~20%)`);
}

async function metadataFields() {
  console.log('\n=== 3. Metadata fields (difficulty / question_style / objective) ===');

  const columns = await sqlClient`
    select column_name, data_type from information_schema.columns
    where table_name = 'cards'
    order by ordinal_position
  `;
  const columnNames = new Set(columns.map((c) => c.column_name as string));

  console.log('cards table columns:', [...columnNames].join(', '));

  const hasDifficulty = columnNames.has('difficulty');
  const hasQuestionStyle = columnNames.has('question_style');
  const hasObjective = columnNames.has('objective');

  console.log(`\ndifficulty column exists: ${hasDifficulty}`);
  if (hasDifficulty) {
    console.log('  NOTE: this is the FSRS algorithm-computed difficulty (real, 0 until first review),');
    console.log('  NOT an authored content-difficulty label. There is no separate authoring-difficulty field.');
    const dist = await sqlClient`
      select difficulty, count(*)::int as count from cards group by difficulty order by difficulty
    `;
    const populated = await sqlClient`select count(*)::int as count from cards where difficulty != 0`;
    console.log(`  Rows with non-default (non-zero) FSRS difficulty: ${populated[0].count} / total`);
    console.log(`  Distribution (rounded FSRS difficulty values):`, dist.slice(0, 10));
  }

  console.log(`\nquestion_style column exists: ${hasQuestionStyle}`);
  console.log(`objective column exists: ${hasObjective}`);
  if (!hasQuestionStyle && !hasObjective) {
    console.log('  Neither exists — no per-card authoring metadata for style or exam objective mapping.');
  }
}

async function scenarioStyle() {
  console.log('\n=== 4. Scenario style heuristic ===');

  const rows = await db.select({ content: cards.content }).from(cards);
  const stems = rows
    .map((r) => {
      const c = r.content as MultipleChoiceContent | MultipleSelectContent | { scenario?: string };
      return 'question' in c ? c.question : 'scenario' in c ? c.scenario : null;
    })
    .filter((s): s is string => typeof s === 'string');

  const total = stems.length;
  const long = stems.filter((s) => s.length > 180);
  const keywordRe = /\b(BEST|MOST|FIRST|LEAST)\b/; // case-sensitive, whole word, per spec
  const withKeyword = stems.filter((s) => keywordRe.test(s));

  console.log(`Stems checked: ${total}`);
  console.log(`  > 180 chars: ${long.length} (${pct(long.length, total)})`);
  console.log(`  contains BEST/MOST/FIRST/LEAST (case-sensitive, whole word): ${withKeyword.length} (${pct(withKeyword.length, total)})`);
}

async function distractorExplanations() {
  console.log('\n=== 5. Distractor explanations ===');

  const rows = await db.select({ content: cards.content }).from(cards);
  const withExplanations = rows.filter((r) => {
    const c = r.content as MultipleChoiceContent | MultipleSelectContent;
    return Array.isArray(c.distractorExplanations) && c.distractorExplanations.length > 0;
  });
  console.log(`Cards with populated distractorExplanations: ${withExplanations.length} / ${rows.length} (${pct(withExplanations.length, rows.length)})`);

  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(explanationSuggestions)
    .where(eq(explanationSuggestions.status, 'pending'));
  console.log(`explanation_suggestions still pending: ${pending.count}`);
}

async function usage() {
  console.log('\n=== 6. Usage (review_log) ===');

  const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(reviewLog);
  console.log(`Total review_log rows: ${total.count}`);

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const byDay = await db
    .select({
      day: sql<string>`to_char(${reviewLog.review}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviewLog)
    .where(gte(reviewLog.review, fourteenDaysAgo))
    .groupBy(sql`to_char(${reviewLog.review}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${reviewLog.review}, 'YYYY-MM-DD')`);

  console.log('\nReviews by day (last 14 days):');
  if (byDay.length === 0) console.log('  (none)');
  for (const d of byDay) console.log(`  ${d.day}: ${d.count}`);

  const [distinctDays] = await db
    .select({ count: sql<number>`count(distinct to_char(${reviewLog.review}, 'YYYY-MM-DD'))::int` })
    .from(reviewLog);
  console.log(`\nDistinct study days (all time): ${distinctDays.count}`);
}

function resultsScreen() {
  console.log('\n=== 7. Results screen ===');
  try {
    const hits = execSync(
      `grep -rniE "results screen|session (summary|review)|end.of.session" app src --include="*.tsx" --include="*.ts" || true`,
      { cwd: process.cwd(), encoding: 'utf-8' }
    ).trim();
    if (hits) {
      console.log('Grep hits:\n' + hits);
    } else {
      console.log('NOT FOUND — no results/summary-screen code in app/ or src/.');
      console.log('src/components/StudySession.tsx currently ends a session by showing only the');
      console.log('last card\'s own Correct/Incorrect + explanation, followed by the plain text');
      console.log('"Session complete." — no per-question review list, no aggregate summary.');
    }
  } catch (e) {
    console.log('grep failed:', e);
  }
}

async function main() {
  console.log('=== Card/DB audit —', new Date().toISOString(), '===');
  await domainBalance();
  await questionTypeMix();
  await metadataFields();
  await scenarioStyle();
  await distractorExplanations();
  await usage();
  resultsScreen();
  console.log('\n=== End of audit ===');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
