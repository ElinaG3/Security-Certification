import React, { useState, useMemo, useEffect } from 'react';

const SecurityPlusLearning = () => {
  // COMPREHENSIVE LEARNING CONTENT - ALL OFFICIAL COMPTIA SECURITY+ V7 OBJECTIVES
  const learningContent = {
    'General Security Concepts (12%)': {
      'Security Controls': {
        description: 'Types of controls and how they work',
        concepts: [
          {
            id: 'sc-1',
            name: 'Control Types & Functions',
            explanation: 'Controls are categorized by function:\n\n• PREVENTIVE: Stop bad things from happening (firewalls, locks, access control)\n• DETECTIVE: Find bad things after they happen (cameras, logs, IDS)\n• CORRECTIVE: Fix damage after incident (restore from backup, restart service)\n• DETERRENT: Discourage attacks (warning signs, visible security)\n• COMPENSATING: Alternative control when primary fails\n• DIRECTIVE: Guide/instruct people (policies, procedures)\n\nAlso categorized by TYPE: Technical, Administrative, Physical',
            visual: `
PREVENTIVE      DETECTIVE       CORRECTIVE
(Stop attack)   (Find attack)   (Fix damage)
Firewall        IDS/IPS logs    Backup restore
Encryption      Monitoring      Patch application
Access control  Alerts          Reboot system

All three work together for defense in depth
            `,
            relatedTo: ['Defense in Depth', 'Risk Management'],
            realWorldExample: 'Bank: locks (preventive) + cameras (detective) + insurance (compensating)'
          },
          {
            id: 'sc-2',
            name: 'Technical vs Administrative vs Physical',
            explanation: 'TECHNICAL: Technology-based (encryption, firewalls, passwords, MFA, software patches)\n\nADMINISTRATIVE: People & policies (security policies, training, background checks, incident procedures, access reviews)\n\nPHYSICAL: Tangible security (locks, fences, guards, ID badges, video cameras, environmental controls)',
            visual: `
┌─────────────────────────────────────┐
│   Defense in Depth: All Three       │
├─────────────────────────────────────┤
│ PHYSICAL: Guards, locks, cameras    │
│ ADMIN:    Policies, training        │
│ TECH:     Encryption, firewalls     │
└─────────────────────────────────────┘
            `,
            relatedTo: ['CIA Triad', 'Least Privilege'],
            realWorldExample: 'Office building: guards (physical) + security policy (admin) + access card reader (technical)'
          }
        ]
      },
      'Authentication, Authorization, Accounting (AAA)': {
        description: 'The security triple that governs access',
        concepts: [
          {
            id: 'aaa-1',
            name: 'AAA Framework',
            explanation: 'AUTHENTICATION: Proving who you are (passwords, MFA, biometrics, certificates)\n\nAUTHORIZATION: What you\'re allowed to do (permissions, roles, policies)\n\nACCOUNTING: Tracking what you did (logs, audit trails, monitoring)',
            visual: `
Step 1: AUTHENTICATION       Step 2: AUTHORIZATION    Step 3: ACCOUNTING
┌─────────────────┐         ┌──────────────────┐     ┌─────────────────┐
│ Login with:     │         │ Can you access   │     │ Logged: User    │
│ • Password      │ ──OK──→ │ this file?       │     │ Accessed: File  │
│ • MFA           │         │ Check role/perms │     │ Time: 09:15 UTC │
│ • Biometric     │         │ ✓ YES or ✗ NO   │     │ Action: READ    │
└─────────────────┘         └──────────────────┘     └─────────────────┘
            `,
            relatedTo: ['Access Control', 'RBAC'],
            realWorldExample: 'Gmail: username/password (auth) → access inbox (authz) → login recorded in audit log (accounting)'
          }
        ]
      },
      'CIA Triad': {
        description: 'Confidentiality, Integrity, Availability',
        concepts: [
          {
            id: 'cia-full',
            name: 'CIA Triad Deep Dive',
            explanation: 'CONFIDENTIALITY: Data not disclosed to unauthorized. Achieved via encryption, access control, classification.\n\nINTEGRITY: Data not modified/corrupted. Achieved via hashing, digital signatures, checksums, access control.\n\nAVAILABILITY: Authorized access when needed. Achieved via redundancy, backups, DDoS protection, capacity planning.',
            visual: `
        ┌─ CONFIDENTIALITY ─┐
        │ (Secret)          │
        │ Encryption        │
        │ Access Control    │
        └───────────────────┘
              │
              │
    ┌─────────┴─────────┐
    │                   │
INTEGRITY         AVAILABILITY
(Accurate)        (Accessible)
Hashing          Backups
Signatures       Redundancy
            `,
            relatedTo: ['Encryption', 'Access Control', 'Disaster Recovery'],
            realWorldExample: 'Hospital: patient data encrypted (confidentiality), hashed (integrity), backed up (availability)'
          }
        ]
      },
      'Zero Trust Model': {
        description: 'Never trust, always verify',
        concepts: [
          {
            id: 'zt-model',
            name: 'Zero Trust Architecture',
            explanation: 'Traditional: Trust everyone inside firewall, verify everything outside (perimeter-based)\n\nZERO TRUST: Verify EVERYONE, EVERYWHERE, always. Every access request verified:\n• Who? (Identity/MFA)\n• What device? (Is it compliant?)\n• Where? (Location normal?)\n• When? (Time normal?)\n• Why? (Purpose justified?)\n• How? (Encrypted connection?)',
            visual: `
TRADITIONAL:                ZERO TRUST:
Outside = ✗ (untrusted)    Every access:
Firewall                    1. Verify identity
Inside = ✓ (trusted)        2. Check device
                            3. Verify location
                            4. Check time
                            5. Validate purpose
                            = Decide: ALLOW or DENY
            `,
            relatedTo: ['MFA', 'Least Privilege', 'Network Segmentation'],
            realWorldExample: 'Google BeyondCorp: VPN removed, every access verified regardless of location'
          }
        ]
      },
      'Cryptography Fundamentals': {
        description: 'Encryption, hashing, digital signatures explained',
        concepts: [
          {
            id: 'crypto-1',
            name: 'Symmetric vs Asymmetric Encryption',
            explanation: 'SYMMETRIC (One key):\n• Same key encrypts & decrypts\n• Fast & efficient\n• Problem: How to share key safely?\n• Examples: AES, DES, 3DES\n• Use: Bulk data encryption\n\nASYMMETRIC (Public-Private key pair):\n• Public key encrypts, Private key decrypts\n• Slower but solves key-sharing problem\n• Examples: RSA, ECC\n• Use: Email encryption, TLS, digital signatures',
            visual: `
SYMMETRIC:
Alice & Bob share SECRET KEY
Alice encrypts → Bob decrypts (same key)
Fast but risky key-sharing

ASYMMETRIC:
Alice has: PUBLIC key (share it!)
Bob has:   PRIVATE key (keep secret!)
Alice encrypts with Bob\'s PUBLIC
Only Bob\'s PRIVATE decrypts
            `,
            relatedTo: ['PKI', 'TLS', 'Digital Signatures'],
            realWorldExample: 'Gmail uses asymmetric for initial contact, then switches to symmetric for speed'
          },
          {
            id: 'crypto-2',
            name: 'Hashing vs Encryption',
            explanation: 'ENCRYPTION: Reversible (decrypt to get original)\n• Password → AES → aBc123 → AES → Password ✓\n• Use: Protect data confidentiality\n\nHASHING: ONE-WAY (cannot unhash)\n• Password → SHA256 → 5e884898da28... (permanent)\n• Use: Verify integrity, store passwords\n\nIMPORTANT: Never hash passwords with MD5/SHA-1 (broken). Use bcrypt, scrypt, Argon2.',
            visual: `
ENCRYPTION:               HASHING:
Plaintext ←→ Ciphertext  Input → Hash (one-way)
(reversible)             Impossible to reverse

Password → AES-256 → ...abc123
                    ← Decrypt

Password → bcrypt → $2b$12$R...
                    (no reverse!)
            `,
            relatedTo: ['Encryption', 'Digital Signatures', 'Password Security'],
            realWorldExample: 'Your password is hashed in databases, encrypted in transit via TLS'
          }
        ]
      }
    },

    'Threats, Vulnerabilities, & Mitigations (22%)': {
      'Threat Actors': {
        description: 'Types of attackers and their motivations',
        concepts: [
          {
            id: 'ta-1',
            name: 'Threat Actor Types',
            explanation: 'NATION-STATES: Governments, highly skilled, motivated by espionage/political goals, unlimited resources\n\nHACKTIVISTS: Activists, motivated by ideology/cause, target companies/governments they disagree with\n\nINSIDER THREATS: Employees/contractors, access to critical systems, motivated by money/revenge/ideology\n\nORGANIZED CRIME: Criminal groups, highly skilled, motivated by money (ransomware, data theft)\n\nSCRIPT KIDDIES: Use existing tools, limited skills, lower sophistication\n\nAPT (Advanced Persistent Threat): Sophisticated, patient, long-term presence, usually state-sponsored',
            visual: `
SOPHISTICATION SPECTRUM:
Script Kiddies ← → Hacktivists ← → Organized Crime ← → Nation-States
(Low)                                                        (High)
Tools            Motivations    Money                Resources
Limited skill    Ideology       Profit               Unlimited
Quick attacks    Political      Ransomware           Espionage
                 Cause          Data theft           Long-term
            `,
            relatedTo: ['Risk Assessment', 'Threat Modeling', 'Incident Response'],
            realWorldExample: 'SolarWinds hack = Nation-state. WannaCry = Organized crime. HackBack group = Hacktivists.'
          }
        ]
      },
      'Threat Vectors & Attack Surfaces': {
        description: 'How attacks happen and where they enter',
        concepts: [
          {
            id: 'tv-1',
            name: 'Common Attack Vectors',
            explanation: 'MESSAGE-BASED: Email phishing, text smishing, social media messages. Targets human psychology.\n\nUNSECURE NETWORKS: WiFi without WPA3, unencrypted connections, MITM attacks\n\nSOCIAL ENGINEERING: Pretexting, baiting, physical tailgating, authority manipulation\n\nFILE-BASED: Malicious attachments, USB drives, downloads\n\nVOICE/VISHING: Phone calls impersonating IT support or executives\n\nSUPPLY CHAIN: Compromised vendors/dependencies, third-party software\n\nWEB-BASED: SQL injection, XSS, CSRF attacks on websites',
            visual: `
ATTACK VECTORS → TARGET → OUTCOME
Email phishing → Employee → Credential theft
Unsecure WiFi → Network → MITM/sniffing
USB device → Endpoint → Malware
Phone call → Employee → Social engineering
Vendor → Application → Supply chain compromise
Website → Web app → Data breach
            `,
            relatedTo: ['Social Engineering', 'Malware', 'Injection Attacks'],
            realWorldExample: 'PayPal phishing → credential theft. SolarWinds supply chain → nation-state APT access.'
          }
        ]
      },
      'Vulnerabilities': {
        description: 'Weaknesses in systems that can be exploited',
        concepts: [
          {
            id: 'vuln-1',
            name: 'Vulnerability Categories',
            explanation: 'APPLICATION: Buffer overflow, SQL injection, XSS, insecure deserialization, broken auth\n\nHARDWARE: Physical tampering, side-channel attacks, firmware vulnerabilities\n\nMOBILE: Insecure storage, weak encryption, malicious apps, jailbreak vulnerabilities\n\nVIRTUALIZATION: VM escape, hypervisor vulnerabilities, container breakout\n\nOPERATING SYSTEM: Unpatched OS, weak permissions, default credentials\n\nCLOUD: Misconfigured storage buckets, insecure APIs, weak IAM\n\nWEB: OWASP Top 10 (injection, broken auth, sensitive data exposure, etc.)',
            visual: `
Vulnerability Lifecycle:
Discovered → CVSS Score → Patch Released → Applied → Fixed
(0-10)      (Severity)   (Vulnerability closes)

CVSS:
0-3.9 = Low
4-6.9 = Medium
7-8.9 = High
9-10  = Critical
            `,
            relatedTo: ['Patch Management', 'Vulnerability Assessment', 'CVSS'],
            realWorldExample: 'Log4Shell (critical RCE) vs typo in comment (low severity)'
          }
        ]
      },
      'Malicious Activity': {
        description: 'Types of attacks and exploitation techniques',
        concepts: [
          {
            id: 'ma-1',
            name: 'Malware Types',
            explanation: 'VIRUS: Attaches to files, needs user action to spread (email attachment)\n\nWORM: Self-replicating, spreads independently (WannaCry, Stuxnet)\n\nTROJAN: Appears legitimate but contains malware (fake antivirus)\n\nRANSOMWARE: Encrypts files, demands payment. Prevention: offline backups\n\nSPYWARE: Monitors activity (keylogging, screen capture)\n\nADWARE: Shows unwanted ads, tracks browsing\n\nROOTKIT: Hides attacker presence at OS level, very persistent\n\nBOTNET: Compromised machines controlled by attacker for DDoS/spam',
            visual: `
MALWARE CHARACTERISTICS:
┌─────────────────────────┐
│ Virus: Needs host file  │
│ Worm: Self-replicating  │
│ Trojan: Disguised       │
│ Ransomware: $ Demands   │
│ Spyware: Monitoring     │
│ Rootkit: Kernel-level   │
└─────────────────────────┘
            `,
            relatedTo: ['Incident Response', 'Antivirus', 'EDR'],
            realWorldExample: 'WannaCry = Worm. Emotet = Botnet. NotPetya = Wiper (destroys data).'
          },
          {
            id: 'ma-2',
            name: 'Network & Cryptographic Attacks',
            explanation: 'DDoS: Overwhelm service with traffic (SYN flood, UDP flood, botnet)\n\nMITM (Man-in-the-Middle): Attacker intercepts & modifies traffic (ARP spoofing, SSL stripping)\n\nRAINBOW TABLES: Precomputed hash tables for fast password cracking. Defeated by salting.\n\nBRUTE FORCE: Try all passwords. Slow but works without rate limiting. Prevented by MFA.\n\nDICTIONARY ATTACK: Try common words/passwords. Faster than brute force.\n\nCRYPTO ATTACKS: Side-channel attacks (timing, power analysis), weak algorithms',
            visual: `
PASSWORD ATTACK SPEED:
Rainbow Tables → Dictionary → Brute Force
(Fastest)      (Medium)      (Slowest)

DDoS ATTACK:
┌─────────┐  ┌─────────┐  ┌─────────┐
│Attacker │→ │Attacker │→ │Attacker │→ Target
│ Bot 1   │  │ Bot 2   │  │ Bot 3   │  (overwhelmed)
└─────────┘  └─────────┘  └─────────┘
            `,
            relatedTo: ['Encryption', 'Password Management', 'DDoS Protection'],
            realWorldExample: 'Twitter DDoS 2020. LinkedIn password lists cracked with rainbow tables.'
          }
        ]
      },
      'Mitigation Techniques': {
        description: 'How to reduce risk from vulnerabilities',
        concepts: [
          {
            id: 'mit-1',
            name: 'Defense Strategies',
            explanation: 'SEGMENTATION: Divide network into zones (DMZ, internal, guest). Contain breach scope.\n\nACCESS CONTROL: Least privilege, RBAC, MFA. Limit what compromised accounts can do.\n\nCONFIGURATION HARDENING: Disable unnecessary services, strong passwords, security baselines.\n\nISOLATION: Separate critical systems, VLANs, air-gapping for highest-security systems.\n\nPATCHING: Fix vulnerabilities quickly. Zero-day patches ASAP. Regular patch management.\n\nMONITORING: Detect attacks early (IDS/IPS, SIEM, EDR). Response time matters.',
            visual: `
LAYERED DEFENSE:
1. Segmentation (DMZ, internal, guest)
2. Access Control (Only need-to-know)
3. Hardening (Remove unnecessary)
4. Encryption (Encrypt everything)
5. Monitoring (Detect breaches)
6. Incident Response (React fast)

If 1 fails, 2-6 still protect you
            `,
            relatedTo: ['Defense in Depth', 'Patch Management', 'Zero Trust'],
            realWorldExample: 'Bank: different segments (customer → employee → vault), each hardened, monitored'
          }
        ]
      }
    },

    'Security Architecture (18%)': {
      'Network Architecture': {
        description: 'Designing secure network structures',
        concepts: [
          {
            id: 'na-1',
            name: 'Network Segmentation & DMZ',
            explanation: 'SEGMENTATION divides network into zones by trust level:\n\nINTERNET (completely untrusted, external)\n↓ FIREWALL\nDMZ (demilitarized zone): Public-facing servers (web, email, DNS). Limited access to internal.\n↓ FIREWALL\nINTERNAL: Employee computers, file servers, databases. Trusted zone.\n↓ FIREWALL\nMANAGEMENT: Admin servers, security tools. Most restricted.\n\nBenefit: If DMZ is hacked, attacker has limited access to critical internal systems.',
            visual: `
┌─────────────────────────────────────┐
│ INTERNET (Attackers)                │
└──────────────┬──────────────────────┘
               │ Firewall 1
┌──────────────▼──────────────────────┐
│ DMZ (Web, Email, DNS servers)       │
│ Limited access to internal          │
└──────────────┬──────────────────────┘
               │ Firewall 2
┌──────────────▼──────────────────────┐
│ INTERNAL (Employees, Databases)     │
│ Trusted zone                        │
└──────────────┬──────────────────────┘
               │ Firewall 3
┌──────────────▼──────────────────────┐
│ MANAGEMENT (Admin, Security tools)  │
│ Highest restriction                 │
└─────────────────────────────────────┘
            `,
            relatedTo: ['Firewalls', 'Network Security', 'Zero Trust'],
            realWorldExample: 'Company web server in DMZ, internal database in INTERNAL zone, admin servers in MANAGEMENT'
          }
        ]
      },
      'Cloud Architecture': {
        description: 'Cloud deployment models and security',
        concepts: [
          {
            id: 'ca-1',
            name: 'Cloud Models & Shared Responsibility',
            explanation: 'ON-PREMISES: You own & manage everything (infra, OS, app, data)\n\nIaaS (Infrastructure-as-a-Service): Provider manages infra (servers, network, storage). You manage OS, apps, data. Example: AWS EC2\n\nPaaS (Platform-as-a-Service): Provider manages infra + OS. You manage apps, data. Example: Heroku\n\nSaaS (Software-as-a-Service): Provider manages everything. You manage data, access. Example: Office 365\n\nSHARED RESPONSIBILITY: Different by service model. Always check what YOU must secure.',
            visual: `
┌────────────────────────────────────────┐
│ ON-PREM: You manage ALL                │
├────────────────────────────────────────┤
│ IaaS: You manage OS, App, Data         │
├────────────────────────────────────────┤
│ PaaS: You manage App, Data             │
├────────────────────────────────────────┤
│ SaaS: You manage Data, Access          │
├────────────────────────────────────────┤
│ Provider manages: Infrastructure       │
└────────────────────────────────────────┘
            `,
            relatedTo: ['Cloud Security', 'Data Protection', 'Compliance'],
            realWorldExample: 'AWS S3 bucket: AWS (infra), YOU (encryption, access control, who can access)'
          }
        ]
      },
      'Data Protection': {
        description: 'Protecting data at rest and in transit',
        concepts: [
          {
            id: 'dp-1',
            name: 'Data Classification & Encryption',
            explanation: 'CLASSIFICATION: PUBLIC (anyone), INTERNAL (employees), CONFIDENTIAL (limited access), RESTRICTED (very limited)\n\nENCRYPTION AT REST: Encrypt stored data (databases, files, backups). Example: AES-256\n\nENCRYPTION IN TRANSIT: Encrypt moving data (networks, emails). Example: TLS 1.2+, VPN\n\nKEY MANAGEMENT: Secure storage of encryption keys (HSM, key vault). Rotation, backup, access control.\n\nTOKENIZATION: Replace sensitive data with tokens (credit card 1234-****-****-5678)',
            visual: `
DATA LIFECYCLE:
┌────────────┐    (Encrypted in transit)    ┌────────────┐
│ Database   │ ←─────────────────────────→  │  Client    │
│ (At rest:  │                              │ (At rest:  │
│  AES-256)  │                              │  AES-256)  │
└────────────┘                              └────────────┘
    ↑
    │ Key stored in HSM
    │ (Hardware Security Module)
            `,
            relatedTo: ['Encryption', 'Compliance', 'Privacy'],
            realWorldExample: 'Hospital: patient data PUBLIC=name, CONFIDENTIAL=SSN, RESTRICTED=medical records'
          }
        ]
      }
    },

    'Security Operations (28%)': {
      'Identity & Access Management': {
        description: 'Controlling who accesses what (28% of exam!)',
        concepts: [
          {
            id: 'iam-1',
            name: 'Access Control Models',
            explanation: 'RBAC (Role-Based): Assign permissions to roles, users get roles. Scalable, used everywhere.\n\nABAC (Attribute-Based): Rules based on attributes (department, location, time, device). Most flexible.\n\nDAC (Discretionary): Owner controls access. Flexible but risky (Windows, Unix).\n\nMAC (Mandatory): Labels/classifications control access. Strict, military systems.\n\nACL (Access Control List): Explicit allow/deny for users/groups on resources.',
            visual: `
RBAC (Most common):
Admin role → Full permissions
Editor role → Read+Write
Viewer role → Read only

ABAC (Most flexible):
IF (department=Sales AND time=business AND location=office)
THEN grant access

DAC (Owner-based):
File owner decides: "Alice can read, Bob can't"

MAC (Label-based):
File label: SECRET
User clearance: SECRET
→ Access granted
            `,
            relatedTo: ['Least Privilege', 'Authentication', 'Authorization'],
            realWorldExample: 'Google Workspace: Admin, Editor, Viewer roles. AWS: IAM policies with conditions.'
          },
          {
            id: 'iam-2',
            name: 'Authentication Methods',
            explanation: 'PASSWORDS: Something you know. Weak alone, must be strong + salted hash.\n\nMULTI-FACTOR (MFA): Combine factors:\n• Something you know: password, PIN\n• Something you have: phone, hardware token, smart card\n• Something you are: fingerprint, face, iris\n\nOAUTH 2.0: Delegate authentication (Login with Google, GitHub)\n\nSAML: Enterprise SSO (Single Sign-On), used in corporations\n\nMUTUAL TLS: Certificate-based, both parties verify each other',
            visual: `
MFA Examples:
Password + OTP = 2FA
Password + Face + Phone = 3FA

OAuth Flow:
User → App: "Login with Google"
App → Google: "Verify this user"
Google ↔ User: (authenticate)
Google → App: "Verified! Here's token"
App → User: "Welcome!"

SAML (Enterprise):
Employee → App: "I need access"
App → IdP: "Is this user real?"
IdP → App: "Yes, verified"
App → Employee: "Welcome"
            `,
            relatedTo: ['Zero Trust', 'AAA', 'SSO'],
            realWorldExample: 'Gmail: password (1FA) + authenticator app (2FA) = secure. GitHub login with 2FA.'
          },
          {
            id: 'iam-3',
            name: 'Privilege Management',
            explanation: 'LEAST PRIVILEGE: Users get only permissions they need. Admin users only when necessary.\n\nJUST-IN-TIME (JIT): Temporary elevated privileges that expire. "I need admin for 30 min"\n\nJUST-ENOUGH ACCESS (JEA): Fine-grained permissions for specific tasks.\n\nSEPARATION OF DUTIES: No single person has complete control (payment = request + approve + execute)\n\nPRIVILEGED ACCESS MANAGEMENT (PAM): Tools to control/audit admin access. Vault sensitive credentials.',
            visual: `
LEAST PRIVILEGE:
User needs SELECT → Give SELECT only
NOT: SELECT + DELETE + DROP

JIT (Just-In-Time):
Request: "I need sudo for 1 hour"
System: Grants, expires automatically
Log: Who, when, what was done

SEPARATION OF DUTIES:
Request $1000 → User A
Approve $1000 → User B
Execute $1000 → User C
(Fraud prevention: 3 people involved)
            `,
            relatedTo: ['Security Controls', 'Audit Trails', 'Compliance'],
            realWorldExample: 'AWS: IAM user with S3 read-only. PAM system: request SSH access, expires in 8 hours.'
          }
        ]
      },
      'Incident Response': {
        description: 'How to handle security incidents',
        concepts: [
          {
            id: 'ir-1',
            name: 'Incident Response Phases',
            explanation: 'PREPARATION: Policies, tools, training, incident response team\n\nDETECTION & ANALYSIS: Identify incident (alert, report, investigation)\n\nCONTAINMENT: Stop spread (isolate systems, disable accounts, block traffic)\n\nERADICATION: Remove attacker (patch, clean malware, change passwords)\n\nRECOVERY: Restore systems to normal operation\n\nPOST-INCIDENT: Lessons learned, document findings, improve defenses',
            visual: `
INCIDENT LIFECYCLE:
1. DETECTION: "We have a problem!"
   ↓
2. CONTAINMENT: "Stop the bleeding"
   ↓
3. ERADICATION: "Remove the threat"
   ↓
4. RECOVERY: "Restore systems"
   ↓
5. LESSONS: "How do we prevent this?"

METRICS:
MTTR = Mean Time To Respond
MTTF = Mean Time To Failure
MTBF = Mean Time Between Failures
            `,
            relatedTo: ['Forensics', 'Threat Hunting', 'SIEM'],
            realWorldExample: 'Ransomware detected → Isolate network → Kill malware → Restore from backup → Fix vulnerability'
          },
          {
            id: 'ir-2',
            name: 'Forensics & Evidence',
            explanation: 'CHAIN OF CUSTODY: Document every person who touched evidence. Essential for legal proceedings.\n\nVOLATILE DATA: RAM is lost on shutdown. Capture it FIRST before powering down.\n\nIMAGING: Create forensic image of disk (bit-by-bit copy, includes deleted files)\n\nHASHING: Verify evidence wasn\'t modified. SHA-256 hash before/after comparison.\n\nDEDUPLICATION: Avoid capturing same data twice (saves storage, time)',
            visual: `
EVIDENCE COLLECTION PRIORITY:
1. RAM (volatile - lost on shutdown)
2. Network connections (volatile)
3. Disk (persistent)
4. Physical artifacts

CHAIN OF CUSTODY:
Evidence collected by: Officer A (time, date)
Evidence transferred to: Officer B (time, date)
Evidence stored in: Evidence locker
Evidence accessed by: Forensic tech (time, logged)
→ No tampering = admissible in court
            `,
            relatedTo: ['Incident Response', 'Legal', 'Investigation'],
            realWorldExample: 'Seized computer: Image disk → Hash recorded → Analysis in isolated lab → Document findings'
          }
        ]
      },
      'Monitoring & Logging': {
        description: 'Seeing what\'s happening in your systems',
        concepts: [
          {
            id: 'ml-1',
            name: 'SIEM & Log Analysis',
            explanation: 'SIEM (Security Information & Event Management): Centralized log collection + correlation + alerting\n\nLOG SOURCES: Firewalls, IDS/IPS, servers, applications, endpoints, cloud services\n\nLOG DATA: Timestamps, user actions, source IP, destination, success/failure\n\nCORRELATION: Link events together (failed logins from same IP → brute force alert)\n\nRETENTION: Keep logs 90 days minimum, compliance may require 7+ years\n\nALERTS: Trigger on suspicious patterns (10 failed logins in 1 min, 3AM admin access)',
            visual: `
SIEM FLOW:
Firewall logs ─┐
Server logs ──→ SIEM ─→ Correlate ─→ Alert
App logs ──────┘      Rules    ─→ Dashboard
                      Patterns    Investigate

LOG EXAMPLE:
Timestamp: 2024-05-27 03:15:22
User: admin
Action: Login
Source IP: 192.168.1.100
Result: SUCCESS
(Used for audit trail & threat detection)
            `,
            relatedTo: ['Threat Detection', 'Incident Response', 'Compliance'],
            realWorldExample: 'SIEM detects: 50 failed logins from same IP in 2 min → Alert security team → Block IP'
          },
          {
            id: 'ml-2',
            name: 'Intrusion Detection & Prevention',
            explanation: 'IDS (Intrusion Detection System): Passive monitoring, detects attacks, sends alerts\n\nIPS (Intrusion Prevention System): Active blocking, detects AND blocks attacks\n\nSIGNATURE-BASED: Known malicious patterns (like antivirus definitions)\n\nANOMALY-BASED: Detects unusual behavior different from baseline\n\nFALSE POSITIVES: Alert on benign traffic (annoying but safe)\n\nFALSE NEGATIVES: Miss real attacks (dangerous!)',
            visual: `
IDS vs IPS:
IDS (Detection):
Malicious traffic → Alert → Manual response

IPS (Prevention):
Malicious traffic → Block automatically

SIGNATURE vs ANOMALY:
Signature: IF (pattern matches known exploit) THEN alert
Anomaly: IF (behavior unusual) THEN alert

Example Anomaly:
Normal: 1000 emails/day
Unusual: 100,000 emails/hour → Alert!
            `,
            relatedTo: ['Firewalls', 'Network Security', 'Threat Detection'],
            realWorldExample: 'IPS blocks SYN flood DoS attack automatically. IDS alerts on SQL injection attempt.'
          }
        ]
      },
      'Vulnerability Management': {
        description: 'Finding and fixing weaknesses',
        concepts: [
          {
            id: 'vm-1',
            name: 'Vulnerability Assessment & Management',
            explanation: 'SCANNING: Automated tools (Nessus, OpenVAS) find vulnerabilities without exploiting\n\nASSESSMENT: Human review of results, prioritization\n\nCVSS SCORING: Severity 0-10 (Critical = 9-10, High = 7-8.9, Medium = 4-6.9, Low = 0-3.9)\n\nPRIORITIZATION: Critical vulns get fixed first\n\nPATCHING: Apply fixes from vendor\n\nVERIFICATION: Rescan to confirm vulnerability is fixed\n\nZERO-DAY: Vulnerability with no patch yet. Mitigate until patch available.',
            visual: `
VULNERABILITY LIFECYCLE:
Discovery → Scan → CVSS Score → Patch → Test → Verify
(Tools)    (Auto)  (9.2=Critical) (Vendor)(Lab)(Rescan)

TIMELINE:
Discovery: Day 0
Patch available: Day 1-30
Deployed: Day 31-60
Critical: ASAP (hours!)
High: 1-2 weeks
Medium: 1-2 months
Low: 3+ months

METRICS:
Mean Time to Patch (MTTP)
Mean Time to Detect (MTTD)
            `,
            relatedTo: ['Patch Management', 'Risk Management', 'Incident Response'],
            realWorldExample: 'Log4Shell = CVSS 10.0 (Critical). Patches deployed within days. Takes months to scan all systems.'
          }
        ]
      }
    },

    'Security Program Management & Oversight (20%)': {
      'Risk Management': {
        description: 'Identifying and managing organizational risks',
        concepts: [
          {
            id: 'rm-1',
            name: 'Risk Assessment Framework',
            explanation: 'RISK = ASSET × THREAT × VULNERABILITY × IMPACT\n\nASS ET: What you\'re protecting (data, systems, reputation)\n\nTHREAT: Potential attacker or bad event\n\nVULNERABILITY: Weakness the threat could exploit\n\nIMPACT: Damage if breach occurs\n\nRISK RESPONSE:\n• MITIGATE: Reduce likelihood/impact (patch, training, controls)\n• AVOID: Don\'t do the risky activity\n• TRANSFER: Insurance, outsourcing\n• ACCEPT: Tolerate small risks (often for low-impact items)',
            visual: `
RISK MATRIX:
      │ Low Impact  │ Med Impact  │ High Impact
──────┼─────────────┼─────────────┼────────────
Low   │ Green ✓     │ Yellow      │ Orange
Prob  │ (accept)    │ (mitigate)  │ (mitigate)
──────┼─────────────┼─────────────┼────────────
Med   │ Yellow      │ Orange      │ Red !
Prob  │ (mitigate)  │ (mitigate)  │ (urgent)
──────┼─────────────┼─────────────┼────────────
High  │ Orange      │ Red !       │ Red !!
Prob  │ (mitigate)  │ (urgent)    │ (critical)

EXAMPLE:
Asset: Customer database (Confidentiality=HIGH)
Threat: Ransomware attack
Vulnerability: Unpatched server
Impact: $1M+ ransom, reputation damage
Risk Level: CRITICAL
Response: MITIGATE (patch immediately)
            `,
            relatedTo: ['Compliance', 'Business Continuity', 'Governance'],
            realWorldExample: 'Company: Can\'t afford perfect security everywhere. Accept low-risk items, focus budget on high-risk.'
          }
        ]
      },
      'Compliance & Governance': {
        description: 'Following laws, standards, and internal policies',
        concepts: [
          {
            id: 'cg-1',
            name: 'Regulations & Standards',
            explanation: 'GDPR (EU): Personal data protection, breach notification within 72 hours, "right to be forgotten"\n\nHIPAA (Healthcare): Patient health records protected, breach notification required\n\nPCI DSS: If you process credit cards, must meet security standards\n\nSOC 2: Compliance audit for cloud/SaaS providers\n\nISO 27001: International Information Security Management standard\n\nNIST: US government framework (Cybersecurity Framework, NIST SP 800-series)\n\nFEDRAMP: For cloud services used by US government',
            visual: `
COMPLIANCE REQUIREMENTS:
GDPR:      EU persons' data       → Encryption, breach notify (72hrs)
HIPAA:     Patient health data    → Encryption, audit logs
PCI DSS:   Credit card data       → Encryption, segmentation
SOC 2:     Cloud provider audit   → Controls documented
ISO 27001: Info security mgmt     → ISMS certification
NIST:      US gov security        → Framework, standards

BREACH NOTIFICATION TIMELINE:
GDPR:  72 hours
HIPAA: 60 days
Most US states: 30-60 days
            `,
            relatedTo: ['Risk Management', 'Data Protection', 'Audits'],
            realWorldExample: 'Company processes EU customers → must comply with GDPR. US healthcare provider → must comply with HIPAA.'
          },
          {
            id: 'cg-2',
            name: 'Data Classification & Privacy',
            explanation: 'CLASSIFICATION LEVELS:\nPUBLIC: Anyone (marketing, blog)\nINTERNAL: Employees only (org chart, policies)\nCONFIDENTIAL: Restricted (customer data, financial)\nRESTRICTED: Maximum protection (trade secrets, API keys)\n\nPRIVACY: User rights (consent, access, deletion, portability)\n\nDATASHRED: Secure deletion (overwrite, shred, destroy)\n\nPURPOSE LIMITATION: Use data only for stated purpose\n\nDATA RETENTION: Keep only as long as needed, then delete',
            visual: `
DATA CLASSIFICATION CONTROLS:
PUBLIC       INTERNAL       CONFIDENTIAL    RESTRICTED
─────────    ────────       ────────────    ──────────
No encrypt   No encrypt     Encrypt         Encrypt
No access    Need to know   Limited access  Minimal access
Public share Employee share Restricted    Secret

Example: Hospital
Name: PUBLIC
Diagnosis: CONFIDENTIAL
SSN: RESTRICTED
Genetic info: RESTRICTED
            `,
            relatedTo: ['Encryption', 'Access Control', 'Compliance'],
            realWorldExample: 'Hospital: patient name=CONFIDENTIAL, disease diagnosis=RESTRICTED, SSN=RESTRICTED'
          }
        ]
      },
      'Security Awareness': {
        description: 'Training people to be the first defense',
        concepts: [
          {
            id: 'sa-1',
            name: 'User Training & Awareness',
            explanation: 'PHISHING TRAINING: Teach employees to spot fake emails (check sender, hover links, verify independently)\n\nSOCIAL ENGINEERING: Recognize pretexting, authority manipulation, urgency tactics\n\nPASSWORD SECURITY: Strong passwords, unique per site, MFA, never share\n\nCLEAN DESK POLICY: Don\'t leave sensitive docs visible\n\nINCIDENT REPORTING: How to report suspicious activity quickly\n\nREGULAR TESTING: Fake phishing emails to test employee response\n\nMETRICS: Track click rates, report rates, completion rates',
            visual: `
PHISHING AWARENESS:
Red flags:
✗ Urgent action required ("Account locked!")
✗ Sender looks close but not quite right
✗ Suspicious links
✗ Requests for passwords
✗ Unexpected attachments
✗ Grammar errors

Safe actions:
✓ Hover link, check URL
✓ Email sender directly (not reply)
✓ Call to verify if unsure
✓ Report to security team

PHISHING CLICK RATES:
Before training: 25-30% click suspicious links
After training: 5-10% (still some, human)
            `,
            relatedTo: ['Incident Response', 'Risk Management', 'Compliance'],
            realWorldExample: 'Company sends fake phishing email: 20% of employees click. They get 30-min security training. Next test: 8% click.'
          }
        ]
      },
      'Audits & Assessments': {
        description: 'Verifying compliance and security effectiveness',
        concepts: [
          {
            id: 'aa-1',
            name: 'Internal & External Audits',
            explanation: 'INTERNAL AUDIT: Company\'s own team checks compliance with policies/standards\n\nEXTERNAL AUDIT: Third-party independent audit for credibility\n\nPENETRATION TESTING: Authorized attack to find vulnerabilities (black-box, white-box, gray-box)\n\nVULNERABILITY ASSESSMENT: Automated scan for weaknesses (no exploitation)\n\nCOMPLIANCE AUDIT: Verify adherence to regulations (GDPR, HIPAA, PCI DSS)\n\nREPORTING: Document findings, remediation plan, verification\n\nATTESTATION: Auditor certifies compliance (SOC 2, ISO 27001)',
            visual: `
AUDIT TYPES:
Internal Audit     → Company itself → Less credible
External Audit     → Third-party   → More credible
Compliance Audit   → Regulations   → Required
Security Audit     → Vulnerabilities → Proactive

PENETRATION TESTING:
Black-box: No knowledge (like real attacker)
White-box: Full knowledge (maximum testing)
Gray-box:  Partial knowledge (realistic)

REMEDIATION TIMELINE:
Critical: Fix within 30 days
High:     Fix within 90 days
Medium:   Fix within 180 days
Low:      Fix within 1 year
            `,
            relatedTo: ['Risk Management', 'Compliance', 'Incident Response'],
            realWorldExample: 'Company: Annual internal audit (compliance). Third-party pentesting (SOC 2). Findings → remediation plan → retest'
          }
        ]
      }
    }
  };
  function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

  // State management (same as before)
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [masteredConcepts, setMasteredConcepts] = usePersistentState('sp_mastered', []);
  const [mode, setMode] = useState('domain-select');

  // Get unique domains
  const domains = useMemo(() => Object.keys(learningContent), []);

  // Handle concept mastery
  const toggleMastered = (conceptId) => {
    setMasteredConcepts(prev => 
      prev.includes(conceptId) 
        ? prev.filter(id => id !== conceptId)
        : [...prev, conceptId]
    );
  };

  // Calculate progress
  const getTopicProgress = (topic) => {
    const concepts = topic.concepts || [];
    const masteredCount = concepts.filter(c => masteredConcepts.includes(c.id)).length;
    return concepts.length > 0 ? Math.round((masteredCount / concepts.length) * 100) : 0;
  };

  const getDomainProgress = (domainName) => {
    const domain = learningContent[domainName];
    const allConcepts = Object.values(domain).flatMap(topic => topic.concepts || []);
    const masteredCount = allConcepts.filter(c => masteredConcepts.includes(c.id)).length;
    return allConcepts.length > 0 ? Math.round((masteredCount / allConcepts.length) * 100) : 0;
  };

  // (Render functions identical to before - domain selection, topic selection, concept view)
  
  // Domain selection screen
  if (mode === 'domain-select') {
    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>📚 CompTIA Security+ Complete Learning (V7)</h1>
        <p style={{ color: '#7f8c8d', marginBottom: '30px' }}>
          All official exam objectives with correct exam weights. {masteredConcepts.length} concepts mastered so far.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '15px'
        }}>
          {domains.map((domain, idx) => {
            const progress = getDomainProgress(domain);
            const weight = domain.match(/\d+%/)?.[0] || '';
            return (
              <div
                key={idx}
                onClick={() => {
                  setSelectedDomain(domain);
                  setMode('topic-select');
                }}
                style={{
                  padding: '20px',
                  background: progress === 100 ? '#e8f8e8' : '#f8f9fa',
                  border: `2px solid ${progress === 100 ? '#27ae60' : '#3498db'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, boxShadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <h3 style={{ color: '#2c3e50', margin: '0 0 10px 0', flex: 1 }}>{domain}</h3>
                  <span style={{ background: '#3498db', color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' }}>{weight}</span>
                </div>
                
                <div style={{ background: '#ecf0f1', borderRadius: '6px', height: '6px', marginBottom: '8px', overflow: 'hidden' }}>
                  <div style={{
                    background: progress === 100 ? '#27ae60' : '#3498db',
                    height: '100%',
                    width: `${progress}%`,
                    transition: 'width 0.3s'
                  }} />
                </div>

                <p style={{ fontSize: '12px', color: '#7f8c8d', margin: 0 }}>
                  {progress}% mastered
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Topic selection screen
  if (mode === 'topic-select' && selectedDomain) {
    const domainTopics = learningContent[selectedDomain];
    const topicNames = Object.keys(domainTopics);

    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => {
              setMode('domain-select');
              setSelectedDomain(null);
            }}
            style={{
              padding: '8px 16px',
              background: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>
          <h1 style={{ color: '#2c3e50', margin: 0 }}>{selectedDomain}</h1>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '15px'
        }}>
          {topicNames.map((topicName, idx) => {
            const topic = domainTopics[topicName];
            const progress = getTopicProgress(topic);
            
            return (
              <div
                key={idx}
                onClick={() => {
                  setSelectedTopic(topicName);
                  setSelectedConcept(topic.concepts?.[0]?.id || null);
                  setMode('concept-view');
                }}
                style={{
                  padding: '15px',
                  background: progress === 100 ? '#e8f8e8' : '#e8f4f8',
                  border: `2px solid ${progress === 100 ? '#27ae60' : '#3498db'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <h3 style={{ color: '#2c3e50', margin: '0 0 8px 0' }}>{topicName}</h3>
                <p style={{ fontSize: '12px', color: '#7f8c8d', margin: '0 0 8px 0' }}>
                  {topic.description}
                </p>
                
                <div style={{ background: '#ecf0f1', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
                  <div style={{
                    background: '#3498db',
                    height: '100%',
                    width: `${progress}%`
                  }} />
                </div>

                <p style={{ fontSize: '11px', color: '#95a5a6', margin: '5px 0 0 0' }}>
                  {progress}% · {topic.concepts?.length || 0} concepts
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Concept view (learning screen)
  if (mode === 'concept-view' && selectedDomain && selectedTopic) {
    const topic = learningContent[selectedDomain][selectedTopic];
    const concepts = topic.concepts || [];
    const currentConceptId = selectedConcept || concepts[0]?.id;
    const currentConcept = concepts.find(c => c.id === currentConceptId);
    const currentIndex = concepts.findIndex(c => c.id === currentConceptId);

    if (!currentConcept) {
      return <div>Concept not found</div>;
    }

    const isMastered = masteredConcepts.includes(currentConceptId);

    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setMode('topic-select')}
            style={{
              padding: '8px 16px',
              background: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '15px'
            }}
          >
            ← Back to Topics
          </button>

          <h1 style={{ color: '#2c3e50', margin: '10px 0 5px 0' }}>{currentConcept.name}</h1>
          <p style={{ color: '#7f8c8d', margin: 0 }}>
            {selectedDomain} › {selectedTopic}
          </p>
        </div>

        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
              Concept {currentIndex + 1} of {concepts.length}
            </div>
            <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
              {masteredConcepts.filter(id => concepts.map(c => c.id).includes(id)).length} / {concepts.length} mastered
            </div>
          </div>
          <div style={{ background: '#ecf0f1', borderRadius: '6px', height: '8px', marginTop: '8px', overflow: 'hidden' }}>
            <div style={{
              background: '#3498db',
              height: '100%',
              width: `${((currentIndex + 1) / concepts.length) * 100}%`
            }} />
          </div>
        </div>

        <div style={{
          background: 'white',
          border: '2px solid #3498db',
          borderRadius: '8px',
          padding: '25px',
          marginBottom: '20px'
        }}>
          {currentConcept.visual && (
            <pre style={{
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'monospace',
              overflow: 'auto',
              marginBottom: '20px',
              color: '#2c3e50'
            }}>
              {currentConcept.visual}
            </pre>
          )}

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#2c3e50', marginTop: 0 }}>Understanding {currentConcept.name}</h3>
            <p style={{ color: '#555', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {currentConcept.explanation}
            </p>
          </div>

          <div style={{
            background: '#fff3cd',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            borderLeft: '4px solid #f39c12'
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
              <strong>Real-world example:</strong> {currentConcept.realWorldExample}
            </p>
          </div>

          {currentConcept.relatedTo && currentConcept.relatedTo.length > 0 && (
            <div>
              <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#7f8c8d', marginBottom: '8px' }}>
                Related concepts:
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {currentConcept.relatedTo.map((rel, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: '#e8f4f8',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      color: '#3498db'
                    }}
                  >
                    {rel}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            onClick={() => toggleMastered(currentConceptId)}
            style={{
              padding: '12px 20px',
              background: isMastered ? '#27ae60' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            {isMastered ? '✓ Mastered' : 'Mark as Mastered'}
          </button>

          {currentIndex > 0 && (
            <button
              onClick={() => setSelectedConcept(concepts[currentIndex - 1].id)}
              style={{
                padding: '10px 16px',
                background: '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              ← Previous
            </button>
          )}

          {currentIndex < concepts.length - 1 && (
            <button
              onClick={() => setSelectedConcept(concepts[currentIndex + 1].id)}
              style={{
                padding: '10px 16px',
                background: '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Next →
            </button>
          )}
        </div>

        <div style={{
          background: '#f8f9fa',
          padding: '15px',
          borderRadius: '6px'
        }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d' }}>
            Jump to concept:
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {concepts.map((concept, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedConcept(concept.id)}
                style={{
                  padding: '8px 12px',
                  background: concept.id === currentConceptId ? '#3498db' : (masteredConcepts.includes(concept.id) ? '#27ae60' : '#ecf0f1'),
                  color: concept.id === currentConceptId || masteredConcepts.includes(concept.id) ? 'white' : '#2c3e50',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {concept.id === currentConceptId ? '→ ' : ''}{masteredConcepts.includes(concept.id) ? '✓ ' : ''}{concept.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
};

export default SecurityPlusLearning;
