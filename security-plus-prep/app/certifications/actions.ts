'use server';

import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { certifications, objectives } from '@/db/schema';

export interface CreateCertificationDomain {
  name: string;
  targetWeight: number;
}

export interface CreateCertificationObjective {
  number: string;
  title: string;
  domain: string;
}

export interface CreateCertificationInput {
  name: string;
  examCode: string;
  domains: CreateCertificationDomain[];
  objectives: CreateCertificationObjective[];
  sessionSize: number;
  minMultiSelect: number;
}

export type CreateCertificationResult = { ok: true; id: string } | { ok: false; issues: string[] };

// Writes the certifications + objectives rows only — filling the cert with
// actual content (ingest a PDF, /create manually, or one of the batch
// scripts with --certification-id=<this id>) is a separate step, exactly
// like SY0-701 was filled after its own row existed.
export async function createCertification(input: CreateCertificationInput): Promise<CreateCertificationResult> {
  const issues: string[] = [];
  if (input.name.trim() === '') issues.push('Name is required.');
  if (input.examCode.trim() === '') issues.push('Exam code is required.');
  if (input.domains.length === 0) issues.push('At least one domain is required.');
  for (const d of input.domains) {
    if (d.name.trim() === '') issues.push('Every domain needs a name.');
    if (!Number.isFinite(d.targetWeight) || d.targetWeight <= 0) issues.push(`Domain "${d.name || '(unnamed)'}" needs a target weight > 0.`);
  }
  const domainNames = new Set(input.domains.map((d) => d.name.trim()).filter(Boolean));
  if (domainNames.size !== input.domains.length) issues.push('Domain names must be unique.');
  const weightSum = input.domains.reduce((sum, d) => sum + (Number.isFinite(d.targetWeight) ? d.targetWeight : 0), 0);
  if (input.domains.length > 0 && Math.abs(weightSum - 100) > 1) {
    issues.push(`Domain target weights should sum to ~100 (currently ${weightSum}).`);
  }
  for (const o of input.objectives) {
    if (o.number.trim() === '') issues.push('Every objective needs a number.');
    if (!domainNames.has(o.domain)) issues.push(`Objective "${o.number}" is assigned to domain "${o.domain}", which isn't one of the domains above.`);
  }
  if (!Number.isFinite(input.sessionSize) || input.sessionSize <= 0) issues.push('Session size must be a positive number.');
  if (!Number.isFinite(input.minMultiSelect) || input.minMultiSelect < 0) issues.push('Min multi-select must be zero or a positive number.');

  if (issues.length > 0) return { ok: false, issues };

  const db = getDb();
  const id = randomUUID();

  await db.insert(certifications).values({
    id,
    name: input.name.trim(),
    examCode: input.examCode.trim(),
    domains: input.domains.map((d) => ({ name: d.name.trim(), targetWeight: d.targetWeight })),
    config: {
      sessionSize: input.sessionSize,
      minMultiSelect: input.minMultiSelect,
      // No UI for this yet — same default split every generation script
      // in this app has used from the start.
      difficultyMix: { recall: 0.2, application: 0.55, analysis: 0.25 },
    },
  });

  if (input.objectives.length > 0) {
    await db.insert(objectives).values(
      input.objectives.map((o) => ({
        certificationId: id,
        number: o.number.trim(),
        title: o.title.trim() || null,
        domain: o.domain,
      }))
    );
  }

  return { ok: true, id };
}
