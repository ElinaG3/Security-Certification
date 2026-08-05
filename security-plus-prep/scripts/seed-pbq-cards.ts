// Hand-authored seed content for the PBQ types (log_analysis, config_table,
// remediation_select) — not AI-generated, since Phase 3 only wires up the
// question types themselves; AI generation for these lands in Phase 4.
// Every card is run through the same structural consistency checks
// generated content will be held to, so day-one content already passes
// what Phase 4 will enforce.
//
// Usage: npx dotenv-cli -e .env.local -e .env -- tsx scripts/seed-pbq-cards.ts

import { eq, and } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import { getCurrentUser } from '../src/lib/auth';
import type { ArtifactPbqContent, RemediationSelectContent } from '../src/db/question-types';
import { checkArtifactPbqConsistency, checkRemediationConsistency } from './check-card-consistency';

export const logAnalysisCards: { domain: string; topic: string; objective: string; content: ArtifactPbqContent }[] = [
  {
    domain: 'Security Operations',
    topic: 'SSH brute-force log review',
    objective: '4.4',
    content: {
      scenario:
        "A SOC analyst is reviewing authentication logs from a Linux jump server after receiving an alert about unusual login activity.",
      artifact: {
        kind: 'log_lines',
        lines: [
          'Jan 14 03:12:01 jump sshd[2201]: Accepted publickey for jdoe from 10.0.4.12 port 51233 ssh2',
          'Jan 14 03:47:15 jump sshd[2340]: Failed password for root from 198.51.100.23 port 41922 ssh2',
          'Jan 14 03:47:16 jump sshd[2341]: Failed password for root from 198.51.100.23 port 41928 ssh2',
          'Jan 14 03:47:16 jump sshd[2342]: Failed password for root from 198.51.100.23 port 41930 ssh2',
          'Jan 14 03:47:17 jump sshd[2343]: Failed password for root from 198.51.100.23 port 41935 ssh2',
          'Jan 14 03:47:19 jump sshd[2344]: Accepted password for root from 198.51.100.23 port 41941 ssh2',
          'Jan 14 03:48:02 jump sshd[2350]: Accepted publickey for jdoe from 10.0.4.12 port 51290 ssh2',
        ],
      },
      subQuestions: [
        {
          answerMode: 'artifact_rows',
          question: 'Which line shows the point at which the attacker succeeded after repeated failures?',
          correct: 5,
          explanationByOption: [
            'This is a legitimate publickey login from an internal address (10.0.4.12) — not part of the attack pattern.',
            'A failed password attempt from the external IP — part of the attack, but not yet a success.',
            'Another failed attempt in the same rapid burst — still not the successful login.',
            'Another failed attempt — the burst continues but hasn’t succeeded yet.',
            'The last failed attempt before the attacker succeeds.',
            'This is the moment the brute-force attempt succeeds — a password login for root from the same external IP that just failed four times in three seconds.',
            'A legitimate publickey login from the same internal admin — unrelated to the attack.',
          ],
        },
        {
          answerMode: 'options',
          question: 'What type of attack does this log excerpt indicate?',
          options: ['SQL injection', 'Brute-force / credential stuffing', 'DNS tunneling', 'Directory traversal'],
          correct: 1,
          explanationByOption: [
            'SQL injection targets a database through an application layer — nothing in an SSH auth log suggests this.',
            'Four rapid failed password attempts against the same account from the same external IP, followed by a success, is the signature of a brute-force (or credential-stuffing) attack against SSH.',
            'DNS tunneling exfiltrates data through DNS queries — this log shows SSH authentication events, not DNS traffic.',
            'Directory traversal exploits path handling in a web application — unrelated to SSH login attempts.',
          ],
        },
        {
          answerMode: 'options',
          question: 'What should the analyst do FIRST?',
          options: [
            'Disable password authentication for root over SSH and force a key rotation',
            'Delete the log entries to avoid alarming other analysts',
            'Wait to see if the attacker logs out on their own',
            'Increase the SSH session timeout',
          ],
          correct: 0,
          explanationByOption: [
            'The immediate priority is to cut off the compromised access path — disabling root password auth and rotating credentials contains the incident before further damage.',
            'Deleting logs destroys evidence needed for the investigation and does nothing to contain the active compromise.',
            'Waiting leaves a successfully compromised root session active — the opposite of containment.',
            'Increasing the timeout makes an active attacker’s session live longer, which is counterproductive during an active compromise.',
          ],
        },
      ],
    },
  },
  {
    domain: 'Security Operations',
    topic: 'Web log injection probing',
    objective: '4.4',
    content: {
      scenario:
        'A web application firewall alert fired for a public-facing e-commerce server. The security analyst pulls the raw access log for the flagged IP.',
      artifact: {
        kind: 'log_lines',
        lines: [
          '203.0.113.44 - - [14/Jan/2026:09:12:01] "GET /product?id=104 HTTP/1.1" 200 4521',
          '203.0.113.44 - - [14/Jan/2026:09:12:03] "GET /product?id=104\' OR \'1\'=\'1 HTTP/1.1" 500 612',
          '203.0.113.44 - - [14/Jan/2026:09:12:05] "GET /../../../../etc/passwd HTTP/1.1" 403 210',
          '203.0.113.44 - - [14/Jan/2026:09:12:08] "GET /product?id=104 UNION SELECT username,password FROM users-- HTTP/1.1" 500 612',
          '198.51.100.9 - - [14/Jan/2026:09:13:40] "GET /cart HTTP/1.1" 200 2210',
        ],
      },
      subQuestions: [
        {
          answerMode: 'artifact_rows',
          question: 'Which lines show an attempted SQL injection against the product page? (Choose two.)',
          correct: [1, 3],
          requiredCount: 2,
          explanationByOption: [
            'A normal, well-formed request for a product page — no injection attempt.',
            'The single-quote and always-true OR \'1\'=\'1 condition is a classic SQL injection probe against the id parameter.',
            'This is a path/directory traversal attempt targeting the OS file system, not a SQL injection.',
            'A UNION SELECT against the users table is a direct SQL injection attempt to exfiltrate credentials.',
            'A normal, unrelated request from a different IP — not part of this attacker’s activity.',
          ],
        },
        {
          answerMode: 'options',
          question: 'What is the line targeting /etc/passwd an example of?',
          options: ['Cross-site scripting (XSS)', 'Directory traversal', 'Cross-site request forgery (CSRF)', 'DNS tunneling'],
          correct: 1,
          explanationByOption: [
            'XSS injects script into pages viewed by other users — this request doesn’t involve any script payload.',
            'Using ../ sequences to escape the web root and reach an OS file like /etc/passwd is the definition of a directory (path) traversal attack.',
            'CSRF tricks an authenticated user’s browser into making an unwanted request — this is a single direct request from an attacker, not a forged cross-site request.',
            'DNS tunneling moves data through DNS queries — this is an HTTP GET request, unrelated to DNS.',
          ],
        },
        {
          answerMode: 'options',
          question: 'What is the MOST effective control to prevent the SQL injection attempts from succeeding?',
          options: [
            'Parameterized queries / prepared statements on the backend',
            'A longer session timeout',
            'Renaming the product endpoint',
            'Enabling verbose error messages for debugging',
          ],
          correct: 0,
          explanationByOption: [
            'Parameterized queries ensure user input is always treated as data, not executable SQL, which directly neutralizes injection attempts regardless of what a WAF catches or misses.',
            'Session timeout has no bearing on whether user input reaches the database as executable SQL.',
            'Renaming the endpoint is security through obscurity — the same vulnerable query logic remains exploitable once the new name is found.',
            'Verbose error messages (as seen in the 500 responses here) actually help an attacker refine their injection — this makes the problem worse, not better.',
          ],
        },
      ],
    },
  },
];

export const configTableCards: { domain: string; topic: string; objective: string; content: ArtifactPbqContent }[] = [
  {
    domain: 'Security Architecture',
    topic: 'Firewall ACL review',
    objective: '3.2',
    content: {
      scenario: 'A security engineer is reviewing the firewall ACL for a newly deployed database subnet before sign-off.',
      artifact: {
        kind: 'table',
        columns: ['#', 'Source', 'Destination', 'Port', 'Action'],
        rows: [
          ['1', '0.0.0.0/0', '10.0.20.5', '22', 'ALLOW'],
          ['2', '10.0.10.0/24', '10.0.20.5', '5432', 'ALLOW'],
          ['3', '0.0.0.0/0', '10.0.20.5', '3389', 'DENY'],
          ['4', '10.0.10.0/24', '10.0.20.5', '443', 'ALLOW'],
        ],
      },
      subQuestions: [
        {
          answerMode: 'artifact_rows',
          question:
            'Which rule represents a misconfiguration for a database server that should only be reachable from the internal app subnet?',
          correct: 0,
          explanationByOption: [
            'Rule 1 allows SSH from the entire internet (0.0.0.0/0) to a database server — this should be restricted to the internal subnet, not open to the world.',
            'Rule 2 correctly scopes database access (5432/Postgres) to the internal application subnet only.',
            'Rule 3 explicitly denies RDP from anywhere, which is appropriate for a Linux database host.',
            'Rule 4 correctly scopes HTTPS access to the internal application subnet only.',
          ],
        },
        {
          answerMode: 'cell_value',
          question: 'Rule 1 should be scoped to the internal app subnet instead of the entire internet. What source should replace 0.0.0.0/0?',
          column: 'Source',
          rows: [0],
          options: ['10.0.10.0/24', '0.0.0.0/0', '10.0.20.0/24', '172.16.0.0/12'],
          correct: [0],
          explanationByOption: [
            '10.0.10.0/24 is the internal application subnet already used correctly by rules 2 and 4 — SSH management access should be scoped the same way.',
            '0.0.0.0/0 is the current misconfiguration itself — leaving it unchanged doesn’t fix anything.',
            '10.0.20.0/24 is the database subnet itself — a source rule shouldn’t scope inbound management traffic from the database’s own subnet.',
            '172.16.0.0/12 doesn’t appear anywhere else in this environment’s addressing and isn’t the app subnet.',
          ],
        },
        {
          answerMode: 'options',
          question: 'Besides fixing rule 1’s source, what additional control would BEST reduce SSH exposure on this database host?',
          options: [
            'Require key-based authentication and disable password login for SSH',
            'Open SSH on additional high ports for redundancy',
            'Change the ACL action from ALLOW to DENY for all rules',
            'Remove the firewall entirely and rely on OS-level users',
          ],
          correct: 0,
          explanationByOption: [
            'Key-based auth with password login disabled removes the most common brute-force attack vector even if network scoping is later loosened by mistake — defense in depth.',
            'Opening additional ports increases the attack surface rather than reducing it.',
            'Denying all rules would also block the legitimate application traffic (rules 2 and 4) that the database needs to function.',
            'Removing the firewall eliminates network-layer segmentation entirely, which is a significant regression, not an improvement.',
          ],
        },
      ],
    },
  },
  {
    domain: 'Security Architecture',
    topic: 'VLAN segmentation review',
    objective: '3.2',
    content: {
      scenario:
        'A network engineer is reviewing switch port configurations after a guest-network laptop was found able to reach internal file shares.',
      artifact: {
        kind: 'table',
        columns: ['Port', 'Description', 'VLAN', 'Port Security'],
        rows: [
          ['Gi1/0/1', 'Guest Wi-Fi AP uplink', '10', 'Disabled'],
          ['Gi1/0/2', 'Finance workstation', '20', 'Enabled'],
          ['Gi1/0/3', 'HR workstation', '20', 'Enabled'],
          ['Gi1/0/4', 'File server', '10', 'Enabled'],
        ],
      },
      subQuestions: [
        {
          answerMode: 'artifact_rows',
          question: 'Which port’s VLAN assignment explains why a guest device can reach the file server?',
          correct: 3,
          explanationByOption: [
            'This is the guest AP uplink itself, correctly on the guest VLAN — not the misconfiguration.',
            'Finance workstation is correctly isolated on the internal VLAN 20.',
            'HR workstation is correctly isolated on the internal VLAN 20.',
            'The file server is assigned to VLAN 10 — the same VLAN as the guest Wi-Fi uplink — so guest traffic reaches it directly instead of being isolated on the internal VLAN 20 like the other internal hosts.',
          ],
        },
        {
          answerMode: 'cell_value',
          question: 'What VLAN should the file server actually be on to match the other internal hosts?',
          column: 'VLAN',
          rows: [3],
          options: ['10', '20', '1', '99'],
          correct: [1],
          explanationByOption: [
            '10 is the guest VLAN — this is the current misconfiguration, not the fix.',
            '20 is the VLAN already used correctly by the Finance and HR internal workstations — the file server belongs there too.',
            'VLAN 1 is the default/native VLAN and is generally avoided for production assignments due to well-known security risks.',
            '99 doesn’t appear anywhere else in this switch’s configuration and isn’t an established internal VLAN here.',
          ],
        },
      ],
    },
  },
];

export const remediationCards: { domain: string; topic: string; objective: string; content: RemediationSelectContent }[] = [
  {
    domain: 'Security Operations',
    topic: 'Ransomware incident remediation',
    objective: '4.9',
    content: {
      scenario:
        'A workstation in the accounting department began encrypting shared drive files and displaying a ransom note. The SOC has confirmed the workstation is compromised and ransomware is actively spreading to a mapped network share.',
      question: 'Select the actions that are appropriate immediate remediation steps for this active ransomware incident.',
      actions: [
        'Isolate the infected workstation from the network immediately',
        'Disable the compromised workstation’s access to the shared drive',
        'Pay the ransom to get the decryption key as quickly as possible',
        'Preserve a forensic image of the workstation before wiping it',
        'Reformat and reimage the workstation immediately without preserving anything',
        'Notify the incident response team and follow the documented IR plan',
      ],
      correctActions: [0, 1, 3, 5],
      explanationByOption: [
        'Network isolation is the first priority — it stops the ransomware from continuing to spread to other systems and shares.',
        'Cutting off access to the shared drive prevents further encryption of shared files even before full isolation completes.',
        'Paying the ransom doesn’t guarantee a working decryption key, funds further criminal activity, and is only ever considered as an absolute last resort after exhausting recovery options — not an immediate action.',
        'Preserving a forensic image before remediation captures evidence needed to determine the infection vector and scope — wiping first destroys that opportunity permanently.',
        'Wiping without preserving anything destroys forensic evidence needed to understand how the ransomware got in, risking the same vector being used again.',
        'Following the documented IR plan and notifying the response team ensures the incident is handled consistently and that stakeholders are looped in appropriately.',
      ],
    },
  },
  {
    domain: 'Security Operations',
    topic: 'Phishing credential compromise remediation',
    objective: '4.9',
    content: {
      scenario:
        'An employee reports clicking a phishing link and entering their corporate credentials on a fake login page. There is no evidence yet that the account has been used maliciously.',
      question: 'Select the actions that are appropriate immediate remediation steps for this credential-compromise report.',
      actions: [
        'Force a password reset for the affected account',
        'Revoke active sessions and re-issue MFA tokens for the account',
        'Ignore it since no malicious activity has been confirmed yet',
        'Review the account’s recent sign-in and mailbox activity logs for anomalies',
        'Publicly announce the employee’s name and mistake to the whole company',
        'Block the phishing domain at the email/web gateway',
      ],
      correctActions: [0, 1, 3, 5],
      explanationByOption: [
        'Resetting the password immediately invalidates the credential the attacker now has, even before confirming misuse.',
        'Revoking active sessions and reissuing MFA tokens closes any session the attacker may have already established using the stolen credential.',
        'Waiting for confirmed malicious activity before acting gives an attacker a window to use the stolen credentials — compromised credentials should be treated as compromised immediately, not after damage is confirmed.',
        'Reviewing sign-in and mailbox activity logs is how you determine whether the credential was actually used and what scope of exposure resulted.',
        'Publicly shaming the employee discourages future incident reporting, which works against a healthy security culture, and does nothing to contain the technical exposure.',
        'Blocking the phishing domain at the gateway prevents other employees from reaching the same fake login page.',
      ],
    },
  },
];

async function main() {
  const db = getDb();
  const user = await getCurrentUser();

  let inserted = 0;
  let skipped = 0;

  for (const card of logAnalysisCards) {
    const issues = checkArtifactPbqConsistency(card.content);
    if (issues.length > 0) {
      console.error(`SKIPPING log_analysis "${card.topic}":\n  - ${issues.join('\n  - ')}`);
      skipped++;
      continue;
    }
    const [existing] = await db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.userId, user.id), eq(cards.topic, card.topic), eq(cards.type, 'log_analysis')));
    if (existing) {
      console.log(`Already seeded: log_analysis "${card.topic}" — skipping.`);
      continue;
    }
    await db.insert(cards).values({
      userId: user.id,
      domain: card.domain,
      topic: card.topic,
      type: 'log_analysis',
      content: card.content,
      status: 'active',
      sourceType: 'manual-seed',
      authoredDifficulty: 'application',
      objective: card.objective,
    });
    inserted++;
  }

  for (const card of configTableCards) {
    const issues = checkArtifactPbqConsistency(card.content);
    if (issues.length > 0) {
      console.error(`SKIPPING config_table "${card.topic}":\n  - ${issues.join('\n  - ')}`);
      skipped++;
      continue;
    }
    const [existing] = await db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.userId, user.id), eq(cards.topic, card.topic), eq(cards.type, 'config_table')));
    if (existing) {
      console.log(`Already seeded: config_table "${card.topic}" — skipping.`);
      continue;
    }
    await db.insert(cards).values({
      userId: user.id,
      domain: card.domain,
      topic: card.topic,
      type: 'config_table',
      content: card.content,
      status: 'active',
      sourceType: 'manual-seed',
      authoredDifficulty: 'application',
      objective: card.objective,
    });
    inserted++;
  }

  for (const card of remediationCards) {
    const issues = checkRemediationConsistency(card.content);
    if (issues.length > 0) {
      console.error(`SKIPPING remediation_select "${card.topic}":\n  - ${issues.join('\n  - ')}`);
      skipped++;
      continue;
    }
    const [existing] = await db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.userId, user.id), eq(cards.topic, card.topic), eq(cards.type, 'remediation_select')));
    if (existing) {
      console.log(`Already seeded: remediation_select "${card.topic}" — skipping.`);
      continue;
    }
    await db.insert(cards).values({
      userId: user.id,
      domain: card.domain,
      topic: card.topic,
      type: 'remediation_select',
      content: card.content,
      status: 'active',
      sourceType: 'manual-seed',
      authoredDifficulty: 'analysis',
      objective: card.objective,
    });
    inserted++;
  }

  console.log(`\nInserted ${inserted} PBQ card(s), skipped ${skipped} failing consistency check(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
