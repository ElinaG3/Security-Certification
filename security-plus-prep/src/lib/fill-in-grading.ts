import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS } from './ai-models';
import { getActiveCertification } from './active-certification';

const client = new Anthropic();

// A small, clearly-bounded starter set of SY0-701 abbreviation<->full-term
// pairs — expand as real fill_in content surfaces gaps. Applied to BOTH the
// user's answer and each accepted answer before comparing, so either
// direction matches (card says "MFA", user types "multi-factor
// authentication", or vice versa).
const KNOWN_SYNONYMS: [string, string][] = [
  ['mfa', 'multi factor authentication'],
  ['2fa', 'two factor authentication'],
  ['sso', 'single sign on'],
  ['vpn', 'virtual private network'],
  ['dns', 'domain name system'],
  ['totp', 'time based one time password'],
  ['hotp', 'hmac based one time password'],
  ['mitm', 'man in the middle'],
  ['ddos', 'distributed denial of service'],
  ['dos', 'denial of service'],
  ['iam', 'identity and access management'],
  ['rbac', 'role based access control'],
  ['mac', 'mandatory access control'],
  ['dac', 'discretionary access control'],
  ['pki', 'public key infrastructure'],
  ['iot', 'internet of things'],
  ['siem', 'security information and event management'],
  ['soar', 'security orchestration automation and response'],
  ['waf', 'web application firewall'],
  ['ids', 'intrusion detection system'],
  ['ips', 'intrusion prevention system'],
];

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[-_/]/g, ' ') // hyphens/underscores/slashes are word separators, not distinguishing characters
    .replace(/[.,!?'"]/g, '') // trailing/embedded punctuation
    .replace(/\s+/g, ' ');
}

function normalizedVariants(raw: string): Set<string> {
  const base = normalize(raw);
  const variants = new Set([base]);
  for (const [abbr, full] of KNOWN_SYNONYMS) {
    if (base === abbr) variants.add(full);
    if (base === full) variants.add(abbr);
  }
  return variants;
}

function stringMatches(userAnswer: string, acceptedAnswers: string[]): boolean {
  const userVariants = normalizedVariants(userAnswer);
  return acceptedAnswers.some((accepted) => {
    const acceptedVariants = normalizedVariants(accepted);
    return [...userVariants].some((v) => acceptedVariants.has(v));
  });
}

const gradeTool: Anthropic.Tool = {
  name: 'grade_answer',
  description: 'Judge whether a candidate answer is functionally equivalent to any accepted answer.',
  input_schema: {
    type: 'object',
    properties: {
      equivalent: {
        type: 'boolean',
        description: 'true if the candidate answer means the same thing as any accepted answer, allowing for phrasing differences but not wrong concepts',
      },
    },
    required: ['equivalent'],
  },
};

async function aiNearMissCheck(userAnswer: string, acceptedAnswers: string[]): Promise<boolean> {
  const cert = await getActiveCertification();
  const response = await client.messages.create({
    model: AI_MODELS.fast,
    max_tokens: 32,
    tools: [gradeTool],
    tool_choice: { type: 'tool', name: 'grade_answer' },
    messages: [
      {
        role: 'user',
        content: `${cert.name} (${cert.examCode}) fill-in-the-blank grading. Candidate answer: "${userAnswer}". Accepted answer(s): ${acceptedAnswers.map((a) => `"${a}"`).join(', ')}. Is the candidate answer functionally equivalent to one of the accepted answers (same concept/term, allowing for phrasing, capitalization, or minor typos) — not just a related-but-different term? Call grade_answer.`,
      },
    ],
  });

  const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
  if (!toolUse) return false;
  return Boolean((toolUse.input as { equivalent?: boolean }).equivalent);
}

export type FillInGrade = { correct: boolean; matchedVia: 'string' | 'ai' };

// String-normalize first (cheap, no API call) — only fall back to a single
// Haiku call when nothing matches, since this is the one runtime AI call
// in the grading path and needs to stay cheap.
export async function gradeFillIn(userAnswer: string, acceptedAnswers: string[]): Promise<FillInGrade> {
  if (stringMatches(userAnswer, acceptedAnswers)) {
    return { correct: true, matchedVia: 'string' };
  }
  if (userAnswer.trim() === '') {
    return { correct: false, matchedVia: 'string' };
  }
  const equivalent = await aiNearMissCheck(userAnswer, acceptedAnswers);
  return { correct: equivalent, matchedVia: 'ai' };
}
