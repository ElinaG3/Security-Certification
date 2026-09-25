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
