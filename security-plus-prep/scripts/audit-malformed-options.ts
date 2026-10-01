// Scans every active multiple_choice/multiple_select card for a specific
// data-corruption bug: an option that's a bare number, empty, or a
// stringified index — the fingerprint of a correct-index value leaking
// into the options array instead of being consumed as the index. Also
// checks option-count-vs-distractorExplanations mismatches and
// out-of-range correct values, which are separate ways the same kind of
// off-by-one/leaked-index bug can show up.
//
// Read-only — writes findings to flagged-malformed-options.txt and prints
// a summary. Never modifies or auto-fixes anything.
//
// Other question types (log_analysis, config_table, remediation_select,
// etc.) have a different content shape and aren't covered here — this is
// scoped to the two types the reported bug actually appeared in.
//
// Usage: npx dotenv-cli -e .env -- tsx scripts/audit-malformed-options.ts

import { writeFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import type { MultipleChoiceContent, MultipleSelectContent } from '../src/db/question-types';

type Content = MultipleChoiceContent | MultipleSelectContent;
type Card = typeof cards.$inferSelect;

// A bare-numeric option is only suspicious when it's mixed in among
// descriptive options — a card whose options are ALL numeric (e.g. a
// legitimate "which port number..." recall question) is not this bug.
// None of the active pool currently has that shape, but the check is
// written to not false-positive if one is added later.
function findMalformedOptionText(options: string[]): string[] {
  const issues: string[] = [];
  if (!Array.isArray(options)) {
    issues.push('options is not an array');
    return issues;
  }
  const trimmed = options.map((o) => (typeof o === 'string' ? o.trim() : String(o)));
  const allNumeric = trimmed.length > 0 && trimmed.every((t) => /^\d+$/.test(t));

  trimmed.forEach((t, idx) => {
    if (t === '') {
      issues.push(`option ${idx} is empty`);
    } else if (/^\d+$/.test(t) && !allNumeric) {
      issues.push(`option ${idx} is a bare number ("${t}") mixed with descriptive options — looks like a correct-index value leaked into the options array`);
    }
  });
  return issues;
}

function findCountMismatch(content: Content): string[] {
  const issues: string[] = [];
  const options = content.options ?? [];
  const de = content.distractorExplanations;
  if (de === undefined) return issues; // absence is a different, already-tracked issue, not this bug
  if (!Array.isArray(de)) {
    issues.push('distractorExplanations is not an array');
  } else if (de.length !== options.length) {
    issues.push(`options.length (${options.length}) !== distractorExplanations.length (${de.length})`);
  }
  return issues;
}

function findOutOfRangeCorrect(content: Content, type: string): string[] {
  const issues: string[] = [];
  const options = content.options ?? [];
  const correctIndices = Array.isArray(content.correct) ? content.correct : [content.correct];
  correctIndices.forEach((idx) => {
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      issues.push(`correct index ${JSON.stringify(idx)} out of range for ${options.length} option(s) (type: ${type})`);
    }
  });
  return issues;
}

function auditCard(card: Card): string[] {
  const content = card.content as Content;
  return [
    ...findMalformedOptionText(content.options),
    ...findCountMismatch(content),
    ...findOutOfRangeCorrect(content, card.type),
  ];
}

function formatFlaggedCard(card: Card, issues: string[]): string {
  const content = card.content as Content;
  const lines: string[] = [];
  lines.push(`\n=== [${card.domain} / ${card.topic}] (${card.type}, ${card.sourceType ?? 'unknown source'}, id ${card.id}) ===`);
  lines.push(`Q: ${content.question}`);
  (content.options ?? []).forEach((opt, idx) => {
    lines.push(`  ${idx}: ${JSON.stringify(opt)}`);
  });
  lines.push(`correct: ${JSON.stringify(content.correct)}`);
  lines.push('Issues:');
  for (const issue of issues) lines.push(`  - ${issue}`);
  return lines.join('\n');
}

async function main() {
  const db = getDb();
  const active = await db.select().from(cards).where(eq(cards.status, 'active'));
  const mcMs = active.filter((c) => c.type === 'multiple_choice' || c.type === 'multiple_select');
  console.log(`Scanning ${mcMs.length} active multiple_choice/multiple_select card(s)...`);

  const flagged: { card: Card; issues: string[] }[] = [];
  for (const card of mcMs) {
    const issues = auditCard(card);
    if (issues.length > 0) flagged.push({ card, issues });
  }

  const byDomain = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const { card } of flagged) {
    byDomain.set(card.domain, (byDomain.get(card.domain) ?? 0) + 1);
    bySource.set(card.sourceType ?? 'unknown', (bySource.get(card.sourceType ?? 'unknown') ?? 0) + 1);
  }

  const report: string[] = [];
  report.push(`Malformed-options audit — ${new Date().toISOString()}`);
  report.push(`Scanned: ${mcMs.length} active multiple_choice/multiple_select card(s)`);
  report.push(`Flagged: ${flagged.length}`);
  report.push(`Flagged by domain: ${JSON.stringify(Object.fromEntries(byDomain))}`);
  report.push(`Flagged by source_type: ${JSON.stringify(Object.fromEntries(bySource))}`);
  report.push(`\n========== FLAGGED CARDS (${flagged.length}) ==========`);
  for (const { card, issues } of flagged) report.push(formatFlaggedCard(card, issues));

  const outPath = 'flagged-malformed-options.txt';
  writeFileSync(outPath, report.join('\n') + '\n');

  console.log(`\n========== SUMMARY ==========`);
  console.log(`Scanned: ${mcMs.length}`);
  console.log(`Flagged: ${flagged.length}`);
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
