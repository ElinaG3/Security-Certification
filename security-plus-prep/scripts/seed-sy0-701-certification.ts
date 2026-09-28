// Multi-certification refactor, Stage 1: inserts the SY0-701 certification
// row (fixed id — see src/lib/certifications.ts) and its objectives list,
// derived from whatever objective numbers already exist in this DB (cards
// + ingested_chunks) rather than a hand-typed list, since that's the real
// ground truth of what's actually been generated/ingested so far.
//
// Idempotent — safe to re-run: skips the cert row if it already exists,
// and skips any objective number already present for this cert.
//
// Usage: npx dotenv-cli -c -- tsx scripts/seed-sy0-701-certification.ts

import { eq, isNotNull } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards, ingestedChunks, certifications, objectives } from '../src/db/schema';
import { SY0_701_CERTIFICATION_ID } from '../src/lib/certifications';
import { DOMAIN_BY_OBJECTIVE_PREFIX, domainForObjective } from '../src/lib/domains';

const CERT_NAME = 'CompTIA Security+';
const EXAM_CODE = 'SY0-701';

// Same 5 domains this app has used since Phase 1 (src/lib/domains.ts),
// with the official SY0-701 exam weights already established and verified
// across several prior sessions (see scripts/generate-security-architecture-cards.ts).
const DOMAINS = [
  { name: 'General Security Concepts', targetWeight: 12 },
  { name: 'Threats, Vulnerabilities, & Mitigations', targetWeight: 22 },
  { name: 'Security Architecture', targetWeight: 18 },
  { name: 'Security Operations', targetWeight: 28 },
  { name: 'Security Program Management and Oversight', targetWeight: 20 },
];

// Current live values — DEFAULT_SESSION_SIZE / MIN_MULTI_SELECT_PER_SESSION
// (src/lib/queue.ts) and the difficulty split scripts/generate-cards.ts
// used for its most recent full batch run.
const CONFIG = {
  sessionSize: 15,
  minMultiSelect: 4,
  difficultyMix: { recall: 0.2, application: 0.55, analysis: 0.25 },
};

async function objectiveTitles(): Promise<Map<string, string>> {
  const db = getDb();
  const chunks = await db
    .select({ objective: ingestedChunks.objective, sectionTitle: ingestedChunks.sectionTitle })
    .from(ingestedChunks)
    .where(isNotNull(ingestedChunks.objective));

  const byObjective = new Map<string, Set<string>>();
  for (const c of chunks) {
    if (!c.objective || !c.sectionTitle) continue;
    if (!byObjective.has(c.objective)) byObjective.set(c.objective, new Set());
    byObjective.get(c.objective)!.add(c.sectionTitle.replace(/\s*\(continued\)$/, ''));
  }

  const titles = new Map<string, string>();
  for (const [objective, titleSet] of byObjective) {
    titles.set(objective, [...titleSet].slice(0, 3).join(' / '));
  }
  return titles;
}

async function main() {
  const db = getDb();

  const [existingCert] = await db.select().from(certifications).where(eq(certifications.id, SY0_701_CERTIFICATION_ID));
  if (existingCert) {
    console.log(`Certification row already exists (${existingCert.name}, ${existingCert.examCode}) — skipping insert.`);
  } else {
    await db.insert(certifications).values({
      id: SY0_701_CERTIFICATION_ID,
      name: CERT_NAME,
      examCode: EXAM_CODE,
      domains: DOMAINS,
      config: CONFIG,
    });
    console.log(`Inserted certification row: ${CERT_NAME} (${EXAM_CODE}), id ${SY0_701_CERTIFICATION_ID}`);
  }

  const [cardObjectives, chunkObjectives, titles, existingObjectives] = await Promise.all([
    db.selectDistinct({ objective: cards.objective }).from(cards).where(isNotNull(cards.objective)),
    db.selectDistinct({ objective: ingestedChunks.objective }).from(ingestedChunks).where(isNotNull(ingestedChunks.objective)),
    objectiveTitles(),
    db.select({ number: objectives.number }).from(objectives).where(eq(objectives.certificationId, SY0_701_CERTIFICATION_ID)),
  ]);

  const allObjectiveNumbers = new Set([
    ...cardObjectives.map((r) => r.objective!),
    ...chunkObjectives.map((r) => r.objective!),
  ]);
  const alreadySeeded = new Set(existingObjectives.map((o) => o.number));

  let inserted = 0;
  let skippedUnrecognizedPrefix = 0;
  for (const number of allObjectiveNumbers) {
    if (alreadySeeded.has(number)) continue;
    const domain = domainForObjective(number);
    if (!domain) {
      skippedUnrecognizedPrefix++;
      console.log(`  SKIP objective "${number}" — prefix doesn't map to a known domain (${JSON.stringify(DOMAIN_BY_OBJECTIVE_PREFIX)})`);
      continue;
    }
    await db.insert(objectives).values({
      certificationId: SY0_701_CERTIFICATION_ID,
      number,
      title: titles.get(number) ?? null,
      domain,
    });
    inserted++;
  }

  console.log(`\nObjectives: ${inserted} inserted, ${alreadySeeded.size} already present, ${skippedUnrecognizedPrefix} skipped (unrecognized prefix).`);

  const finalCount = await db.select().from(objectives).where(eq(objectives.certificationId, SY0_701_CERTIFICATION_ID));
  console.log(`Total objectives now on the SY0-701 certification row: ${finalCount.length} (expected ${allObjectiveNumbers.size}).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
