import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { certifications, objectives as objectivesTable } from '@/db/schema';
import { SY0_701_CERTIFICATION_ID } from './certifications';
import { getCurrentUser } from './auth';

// Multi-certification refactor, Stage 3. This was the seam Stage 2 called
// out: every live read path in the app already goes through THIS
// function (not the old hardcoded src/lib/domains.ts constants), so
// resolving from real user selection instead of a fixed constant is the
// only change needed here — nothing downstream changes.
//
// cache() (React, not a manual memo) dedupes calls within one request/
// render pass — dashboard, topics, and queue queries all ask for the
// active certification without each paying for a separate DB round trip.
export const getActiveCertificationId = cache(async (): Promise<string> => {
  const user = await getCurrentUser();
  return user.activeCertificationId ?? SY0_701_CERTIFICATION_ID;
});

export interface CertDomain {
  name: string;
  targetWeight: number;
}

export interface CertConfig {
  sessionSize: number;
  minMultiSelect: number;
  // Minimum typed-answer (fill_in) cards guaranteed per due-queue session,
  // same composition-guarantee mechanism as minMultiSelect. Optional/
  // defaults to 0 so a certification created before this existed (or a
  // brand-new one with no fill_in cards yet) doesn't need a migration —
  // see getDueQueue's `?? 0` fallback.
  minFillIn?: number;
  difficultyMix: Record<string, number>;
}

export interface ActiveCertification {
  id: string;
  name: string;
  examCode: string;
  domains: CertDomain[];
  config: CertConfig;
}

export const getActiveCertification = cache(async (): Promise<ActiveCertification> => {
  const db = getDb();
  const id = await getActiveCertificationId();
  const [row] = await db.select().from(certifications).where(eq(certifications.id, id));
  if (!row) throw new Error(`Active certification ${id} not found — did scripts/seed-sy0-701-certification.ts run?`);
  return {
    id: row.id,
    name: row.name,
    examCode: row.examCode,
    domains: row.domains as CertDomain[],
    config: row.config as CertConfig,
  };
});

// Domain names, in the cert's own stored order — same role SY0_701_DOMAINS
// used to play (grouping/iteration order on dashboard/topics/recall pages).
export const getActiveDomains = cache(async (): Promise<string[]> => {
  const cert = await getActiveCertification();
  return cert.domains.map((d) => d.name);
});

export const getActiveDomainWeights = cache(async (): Promise<Record<string, number>> => {
  const cert = await getActiveCertification();
  return Object.fromEntries(cert.domains.map((d) => [d.name, d.targetWeight]));
});

export interface ActiveObjective {
  number: string;
  domain: string;
  title: string | null;
}

export const getActiveObjectives = cache(async (): Promise<ActiveObjective[]> => {
  const db = getDb();
  const certId = await getActiveCertificationId();
  const rows = await db.select().from(objectivesTable).where(eq(objectivesTable.certificationId, certId));
  return rows.map((r) => ({ number: r.number, domain: r.domain, title: r.title }));
});

// Replaces the old synchronous domainForObjective(objective) — same
// question, answered from the objectives table instead of a hardcoded
// prefix map. null for an objective number the active cert doesn't know
// about, same as the old function's behavior.
export async function domainForObjectiveActive(objectiveNumber: string): Promise<string | null> {
  const objectivesList = await getActiveObjectives();
  return objectivesList.find((o) => o.number === objectiveNumber)?.domain ?? null;
}

export interface CertificationOption {
  id: string;
  name: string;
  examCode: string;
}

// For the switcher's dropdown — every certification that exists, not just
// the active one.
export async function listCertifications(): Promise<CertificationOption[]> {
  const db = getDb();
  return db.select({ id: certifications.id, name: certifications.name, examCode: certifications.examCode }).from(certifications);
}
