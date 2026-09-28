// Shared CLI-script resolver for the multi-certification refactor, Stage
// 4. Deliberately separate from src/lib/active-certification.ts: that
// module is request/session-scoped (wrapped in React's cache(), resolves
// via the logged-in user's own selection) which doesn't apply to a
// standalone `tsx script.ts` invocation — a CLI script gets its target
// certification from an explicit --certification-id flag instead,
// defaulting to SY0-701 so every existing invocation keeps working
// unchanged.
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { certifications, objectives } from '../src/db/schema';
import { SY0_701_CERTIFICATION_ID } from '../src/lib/certifications';

export interface CliDomain {
  name: string;
  targetWeight: number;
}

export interface CliObjective {
  number: string;
  domain: string;
  title: string | null;
}

export interface CliCertification {
  id: string;
  name: string;
  examCode: string;
  domains: CliDomain[];
  objectives: CliObjective[];
}

export function parseCertificationIdArg(): string {
  const arg = process.argv.find((a) => a.startsWith('--certification-id='));
  return arg ? arg.slice('--certification-id='.length) : SY0_701_CERTIFICATION_ID;
}

export async function resolveCliCertification(certificationId: string): Promise<CliCertification> {
  const db = getDb();
  const [row] = await db.select().from(certifications).where(eq(certifications.id, certificationId));
  if (!row) {
    throw new Error(`Certification ${certificationId} not found. Create it first (the add-certification UI, or scripts/seed-sy0-701-certification.ts's pattern).`);
  }
  const objectiveRows = await db.select().from(objectives).where(eq(objectives.certificationId, certificationId));
  return {
    id: row.id,
    name: row.name,
    examCode: row.examCode,
    domains: row.domains as CliDomain[],
    objectives: objectiveRows.map((o) => ({ number: o.number, domain: o.domain, title: o.title })),
  };
}

export function domainForObjectiveIn(cert: CliCertification, objectiveNumber: string): string | null {
  return cert.objectives.find((o) => o.number === objectiveNumber)?.domain ?? null;
}

// Guard for scripts whose content PLAN (hand-authored per-objective hints,
// domain-specific rewrite logic, etc.) is inherently written for SY0-701's
// actual subject matter — not something a --certification-id flag alone
// can generalize. Refuses to silently generate SY0-701-shaped content
// under a different cert's name; that's a worse failure mode than just
// erroring clearly and saying so.
export function requireSy0701(cert: CliCertification, scriptName: string): void {
  if (cert.id !== SY0_701_CERTIFICATION_ID) {
    throw new Error(
      `${scriptName}'s content plan (objective hints / domain assignments / rewrite targets) is hand-authored for SY0-701's actual subject matter and doesn't generalize to "${cert.name}" (${cert.examCode}) just by changing which certification_id is passed. ` +
        `Write a new plan for this cert's objectives, or use ingest-pdf.ts / generate-cards.ts, which are genuinely source-driven / domain-weight-driven rather than hint-driven.`
    );
  }
}
