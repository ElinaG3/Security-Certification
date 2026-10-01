// Short column headers for the home page's progress grid — falls back to
// the full name (rare for a certification without a curated mapping,
// still correct, just longer) rather than a generic truncation that could
// cut a name mid-word.
const SHORT_NAMES: Record<string, string> = {
  'General Security Concepts': 'General Security',
  'Threats, Vulnerabilities, & Mitigations': 'Threats & Vulns',
  'Security Architecture': 'Architecture',
  'Security Operations': 'Operations',
  'Security Program Management and Oversight': 'Program Mgmt',
};

export function shortDomainName(fullName: string): string {
  return SHORT_NAMES[fullName] ?? fullName;
}
