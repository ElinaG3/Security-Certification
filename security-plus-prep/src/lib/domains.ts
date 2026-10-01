// Split out from card-generation.ts on purpose: this has no server-only
// dependencies (unlike card-generation.ts, which instantiates the
// Anthropic client at module scope), so client components can import it
// without pulling the Anthropic SDK — and Node built-ins it needs — into
// the browser bundle.
export const SY0_701_DOMAINS = [
  'General Security Concepts',
  'Threats, Vulnerabilities, & Mitigations',
  'Security Architecture',
  'Security Operations',
  'Security Program Management and Oversight',
] as const;

// An objective NUMBER's domain is fixed by its prefix, per the official
// SY0-701 domain structure — authoritative, and deliberately NOT the same
// thing as trusting a card's own `domain` column (a DB audit found 33/328
// already-classified cards where the two disagree; see
// scripts/backfill-legacy-objectives.ts). Anything that needs "which
// domain does objective X belong to" should use this, not cards.domain.
export const DOMAIN_BY_OBJECTIVE_PREFIX: Record<string, (typeof SY0_701_DOMAINS)[number]> = {
  '1': 'General Security Concepts',
  '2': 'Threats, Vulnerabilities, & Mitigations',
  '3': 'Security Architecture',
  '4': 'Security Operations',
  '5': 'Security Program Management and Oversight',
};

export function domainForObjective(objective: string): string | null {
  return DOMAIN_BY_OBJECTIVE_PREFIX[objective.split('.')[0]] ?? null;
}
