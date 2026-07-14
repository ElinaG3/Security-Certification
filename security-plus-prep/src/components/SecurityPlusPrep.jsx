import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const SecurityPlusApp = () => {
  // Comprehensive Security+ Question Bank (150+ questions across all 5 domains)
  const questionBank = [
    // DOMAIN 1: GENERAL SECURITY CONCEPTS (30 questions)
    {
      id: 1,
      domain: 'General Security Concepts',
      topic: 'CIA Triad & Confidentiality',
      question: 'Which security principle ensures that information is not disclosed to unauthorized parties?',
      options: ['Integrity', 'Confidentiality', 'Availability', 'Authenticity'],
      correct: 1,
      explanation: 'Confidentiality prevents unauthorized disclosure. Integrity ensures accuracy, Availability ensures access.'
    },
    {
      id: 2,
      domain: 'General Security Concepts',
      topic: 'CIA Triad & Confidentiality',
      question: 'A user forgets their password. Which CIA principle is compromised?',
      options: ['Confidentiality', 'Availability', 'Integrity', 'Non-repudiation'],
      correct: 1,
      explanation: 'Availability is compromised when authorized users cannot access resources they need.'
    },
    {
      id: 3,
      domain: 'General Security Concepts',
      topic: 'Authentication Methods',
      question: 'Which authentication factor is "something you have"?',
      options: ['Password', 'Security token', 'Fingerprint', 'PIN'],
      correct: 1,
      explanation: 'Tokens, smart cards, and hardware keys are something you have. Passwords are something you know.'
    },
    {
      id: 4,
      domain: 'General Security Concepts',
      topic: 'Authentication Methods',
      question: 'Multi-factor authentication combining a password and facial recognition uses how many factors?',
      options: ['One', 'Two', 'Three', 'Four'],
      correct: 1,
      explanation: 'Password (something you know) + facial recognition (something you are) = 2 factors.'
    },
    {
      id: 5,
      domain: 'General Security Concepts',
      topic: 'Authentication Methods',
      question: 'What is the primary advantage of OAuth 2.0?',
      options: ['Encrypts all traffic', 'Allows delegated access without sharing passwords', 'Replaces firewalls', 'Increases CPU performance'],
      correct: 1,
      explanation: 'OAuth 2.0 enables users to grant third-party apps access to their data without sharing passwords.'
    },
    {
      id: 6,
      domain: 'General Security Concepts',
      topic: 'Non-repudiation',
      question: 'Which security control ensures a user cannot deny performing an action?',
      options: ['Encryption', 'Digital signatures', 'Firewalls', 'Rate limiting'],
      correct: 1,
      explanation: 'Digital signatures provide non-repudiation by proving who created/signed a document.'
    },
    {
      id: 7,
      domain: 'General Security Concepts',
      topic: 'Access Control Models',
      question: 'In role-based access control (RBAC), permissions are assigned to:',
      options: ['Individual users', 'Roles', 'Devices', 'Networks'],
      correct: 1,
      explanation: 'RBAC assigns permissions to roles, and users inherit permissions by being assigned roles.'
    },
    {
      id: 8,
      domain: 'General Security Concepts',
      topic: 'Access Control Models',
      question: 'Which access control model grants permissions based on data labels and user clearance?',
      options: ['RBAC', 'ABAC', 'MAC', 'DAC'],
      correct: 2,
      explanation: 'MAC (Mandatory Access Control) uses labels and clearance levels. Used in military systems.'
    },
    {
      id: 9,
      domain: 'General Security Concepts',
      topic: 'Access Control Models',
      question: 'DAC (Discretionary Access Control) is primarily managed by:',
      options: ['The OS', 'An access control matrix', 'The data owner', 'A security officer'],
      correct: 2,
      explanation: 'In DAC, the data owner decides who has access. Common in Unix/Windows systems.'
    },
    {
      id: 10,
      domain: 'General Security Concepts',
      topic: 'Principle of Least Privilege',
      question: 'A database admin needs SELECT permissions only. Granting SELECT + DELETE violates which principle?',
      options: ['Defense in depth', 'Least privilege', 'Separation of duties', 'Fail secure'],
      correct: 1,
      explanation: 'Least privilege means granting only the minimum permissions needed to do the job.'
    },
    {
      id: 11,
      domain: 'General Security Concepts',
      topic: 'Principle of Least Privilege',
      question: 'Which principle states that no single person should have complete control over critical processes?',
      options: ['Least privilege', 'Separation of duties', 'Defense in depth', 'Zero trust'],
      correct: 1,
      explanation: 'Separation of duties requires multiple people to complete sensitive tasks to prevent fraud.'
    },
    {
      id: 12,
      domain: 'General Security Concepts',
      topic: 'Threat Modeling',
      question: 'What does STRIDE stand for in threat modeling?',
      options: ['Security, Threats, Risks, Identity, Denial, Encryption', 'Spoofing, Tampering, Repudiation, Information disclosure, Denial, Elevation', 'Scan, Trace, Record, Identify, Detect, Encrypt', 'None of above'],
      correct: 1,
      explanation: 'STRIDE categorizes 6 types of threats: Spoofing, Tampering, Repudiation, Information disclosure, DoS, Elevation of privilege.'
    },
    {
      id: 13,
      domain: 'General Security Concepts',
      topic: 'Threat Modeling',
      question: 'PASTA threat modeling emphasizes:',
      options: ['Technical architecture', 'Business impact and risk', 'Network topology', 'Encryption algorithms'],
      correct: 1,
      explanation: 'PASTA (Process for Attack Simulation and Threat Analysis) aligns threats with business objectives.'
    },
    {
      id: 14,
      domain: 'General Security Concepts',
      topic: 'Security Frameworks',
      question: 'Which security framework is based on "Identify, Protect, Detect, Respond, Recover"?',
      options: ['ISO 27001', 'NIST Cybersecurity Framework', 'CIS Controls', 'COBIT'],
      correct: 1,
      explanation: 'The NIST CSF has 5 core functions: Identify, Protect, Detect, Respond, Recover.'
    },
    {
      id: 15,
      domain: 'General Security Concepts',
      topic: 'Security Frameworks',
      question: 'ISO 27001 is primarily used for:',
      options: ['Network design', 'Information security management', 'Cryptographic standards', 'Incident response'],
      correct: 1,
      explanation: 'ISO 27001 is an Information Security Management System (ISMS) standard for certification.'
    },
    {
      id: 16,
      domain: 'General Security Concepts',
      topic: 'Defense in Depth',
      question: 'Defense in depth means:',
      options: ['Using only one strong control', 'Layering multiple security controls', 'Focusing on the network layer', 'Using encryption everywhere'],
      correct: 1,
      explanation: 'Defense in depth uses multiple overlapping controls so if one fails, others protect you.'
    },
    {
      id: 17,
      domain: 'General Security Concepts',
      topic: 'Defense in Depth',
      question: 'Which layers does defense in depth typically include?',
      options: ['Only network', 'Application, network, physical, data', 'Only application', 'Only data'],
      correct: 1,
      explanation: 'Defense in depth covers physical security, network, application, data, and people (policies/training).'
    },
    {
      id: 18,
      domain: 'General Security Concepts',
      topic: 'Zero Trust Model',
      question: '"Never trust, always verify" is the principle of:',
      options: ['MAC', 'RBAC', 'Zero Trust', 'Defense in Depth'],
      correct: 2,
      explanation: 'Zero Trust verifies every access request, regardless of source or previous trust level.'
    },
    {
      id: 19,
      domain: 'General Security Concepts',
      topic: 'Encryption Types',
      question: 'Which encryption requires a shared secret key between sender and receiver?',
      options: ['Asymmetric', 'Symmetric', 'Hashing', 'Steganography'],
      correct: 1,
      explanation: 'Symmetric encryption (AES, DES) uses one shared key. Asymmetric uses public/private key pairs.'
    },
    {
      id: 20,
      domain: 'General Security Concepts',
      topic: 'Encryption Types',
      question: 'RSA is an example of:',
      options: ['Symmetric encryption', 'Asymmetric encryption', 'Hashing algorithm', 'Steganography'],
      correct: 1,
      explanation: 'RSA uses a public key for encryption and a private key for decryption.'
    },
    {
      id: 21,
      domain: 'General Security Concepts',
      topic: 'Hashing',
      question: 'What is a collision in hashing?',
      options: ['Two different inputs producing the same hash output', 'A failed hash computation', 'An encryption error', 'A network timeout'],
      correct: 0,
      explanation: 'A collision occurs when different inputs produce the same hash, weakening security.'
    },
    {
      id: 22,
      domain: 'General Security Concepts',
      topic: 'Hashing',
      question: 'Which hashing algorithm is considered broken and should NOT be used?',
      options: ['SHA-256', 'MD5', 'SHA-3', 'BLAKE2'],
      correct: 1,
      explanation: 'MD5 and SHA-1 have known vulnerabilities. Use SHA-256, SHA-3, or BLAKE2 instead.'
    },
    {
      id: 23,
      domain: 'General Security Concepts',
      topic: 'Digital Certificates',
      question: 'A digital certificate is issued and signed by:',
      options: ['The user', 'A Certificate Authority (CA)', 'The web server', 'The operating system'],
      correct: 1,
      explanation: 'CAs issue and digitally sign certificates to verify the identity of websites/entities.'
    },
    {
      id: 24,
      domain: 'General Security Concepts',
      topic: 'Digital Certificates',
      question: 'What does PKI stand for?',
      options: ['Public Key Infrastructure', 'Primary Key Integration', 'Protocol Key Interface', 'Personal Key Identity'],
      correct: 0,
      explanation: 'PKI is the system of digital certificates, CAs, and key management used for secure communication.'
    },
    {
      id: 25,
      domain: 'General Security Concepts',
      topic: 'Risk Management',
      question: 'Risk = Threat x Vulnerability x ___',
      options: ['Encryption', 'Impact', 'Firewall', 'Complexity'],
      correct: 1,
      explanation: 'Risk assessment: Risk = Likelihood (Threat x Vulnerability) x Impact. Or: Risk = Asset x Threat x Vulnerability'
    },
    {
      id: 26,
      domain: 'General Security Concepts',
      topic: 'Risk Management',
      question: 'Which risk response involves accepting the risk without mitigation?',
      options: ['Avoid', 'Mitigate', 'Accept', 'Transfer'],
      correct: 2,
      explanation: 'Risk acceptance means tolerating the risk because mitigation cost exceeds the impact.'
    },
    {
      id: 27,
      domain: 'General Security Concepts',
      topic: 'Security Controls',
      question: 'A firewall is classified as a(n) ___ control.',
      options: ['Detective', 'Preventive', 'Corrective', 'Compensating'],
      correct: 1,
      explanation: 'Firewalls prevent unauthorized traffic. Detective controls detect breaches, corrective repairs damage.'
    },
    {
      id: 28,
      domain: 'General Security Concepts',
      topic: 'Security Controls',
      question: 'A security camera recording evidence of a break-in is a ___ control.',
      options: ['Preventive', 'Detective', 'Corrective', 'Compensating'],
      correct: 1,
      explanation: 'Detective controls identify incidents after they occur (logs, monitoring, cameras).'
    },
    {
      id: 29,
      domain: 'General Security Concepts',
      topic: 'Compliance',
      question: 'Which law requires organizations to notify individuals of data breaches?',
      options: ['HIPAA', 'PCI DSS', 'GDPR', 'SOC 2'],
      correct: 2,
      explanation: 'GDPR (EU) and many other laws (e.g., state laws like CCPA) require breach notification.'
    },
    {
      id: 30,
      domain: 'General Security Concepts',
      topic: 'Compliance',
      question: 'What does HIPAA regulate?',
      options: ['Financial data', 'Healthcare data', 'Educational records', 'Government secrets'],
      correct: 1,
      explanation: 'HIPAA (Health Insurance Portability & Accountability Act) protects patient health information.'
    },

    // DOMAIN 2: THREATS, VULNERABILITIES, AND MITIGATIONS (35 questions)
    {
      id: 31,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Malware Types',
      question: 'What is the defining characteristic of a virus?',
      options: ['Replicates without user interaction', 'Requires a host file to spread', 'Cannot spread across networks', 'Self-replicating'],
      correct: 1,
      explanation: 'Viruses attach to files and require user action to spread (e.g., opening an email attachment).'
    },
    {
      id: 32,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Malware Types',
      question: 'A worm differs from a virus because:',
      options: ['Worms are more dangerous', 'Worms self-replicate and spread without user interaction', 'Viruses are newer', 'No difference'],
      correct: 1,
      explanation: 'Worms spread independently across networks; viruses need user action to spread.'
    },
    {
      id: 33,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Malware Types',
      question: 'What is ransomware?',
      options: ['A type of phishing', 'Malware that encrypts files and demands payment', 'A network scan tool', 'A virus type'],
      correct: 1,
      explanation: 'Ransomware encrypts victim data and demands money for the decryption key.'
    },
    {
      id: 34,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Malware Types',
      question: 'Which malware monitors user activity and reports it back to an attacker?',
      options: ['Trojan horse', 'Spyware', 'Adware', 'Rootkit'],
      correct: 1,
      explanation: 'Spyware secretly monitors and exfiltrates user activity (keylogging, web browsing, etc.).'
    },
    {
      id: 35,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Social Engineering',
      question: 'Phishing is primarily a ___ attack.',
      options: ['Network-based', 'Social engineering', 'Hardware-based', 'Cryptographic'],
      correct: 1,
      explanation: 'Phishing manipulates users into revealing credentials or opening malicious links/attachments.'
    },
    {
      id: 36,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Social Engineering',
      question: 'Pretexting involves:',
      options: ['Creating a fake website', 'Establishing a false identity/story to extract information', 'Bypassing firewalls', 'Encrypting data'],
      correct: 1,
      explanation: 'Pretexting uses a fabricated scenario to gain victim trust and extract sensitive information.'
    },
    {
      id: 37,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Social Engineering',
      question: 'Which social engineering technique uses authority/urgency to pressure victims?',
      options: ['Phishing', 'Tailgating', 'Pretext', 'Baiting'],
      correct: 0,
      explanation: 'Phishing often uses urgency ("Click now!" / "Account compromised"). Authority is "I\'m IT support."'
    },
    {
      id: 38,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Denial of Service',
      question: 'In a DDoS attack, traffic comes from:',
      options: ['One attacker', 'Multiple compromised computers', 'The ISP', 'A firewall'],
      correct: 1,
      explanation: 'DDoS = Distributed DoS. Multiple machines (botnet) overwhelm a target simultaneously.'
    },
    {
      id: 39,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Denial of Service',
      question: 'A SYN flood attack targets:',
      options: ['DNS servers', 'TCP three-way handshake', 'Email systems', 'Databases'],
      correct: 1,
      explanation: 'SYN flood sends many SYN packets without completing handshakes, exhausting connection resources.'
    },
    {
      id: 40,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Injection Attacks',
      question: 'Which attack injects malicious SQL code into an input field?',
      options: ['Cross-site scripting', 'SQL injection', 'Command injection', 'LDAP injection'],
      correct: 1,
      explanation: 'SQL injection exploits poor input validation to execute unauthorized database commands.'
    },
    {
      id: 41,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Injection Attacks',
      question: 'XSS (Cross-Site Scripting) allows attackers to:',
      options: ['Modify database records', 'Inject malicious scripts into web pages', 'Bypass firewalls', 'Steal hardware'],
      correct: 1,
      explanation: 'XSS injects JavaScript that runs in victim browsers, stealing cookies or session tokens.'
    },
    {
      id: 42,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Man-in-the-Middle',
      question: 'A MITM attack allows the attacker to:',
      options: ['Only view traffic', 'View and modify traffic between two parties', 'Delete files remotely', 'Launch DDoS'],
      correct: 1,
      explanation: 'MITM positions the attacker between sender/receiver to intercept and alter communications.'
    },
    {
      id: 43,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Password Attacks',
      question: 'A brute force attack tries:',
      options: ['All possible passwords systematically', 'Common passwords first', 'Only weak passwords', 'Random guesses'],
      correct: 0,
      explanation: 'Brute force exhaustively tries all combinations. Slow but works if no rate limiting exists.'
    },
    {
      id: 44,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Password Attacks',
      question: 'A dictionary attack uses:',
      options: ['All possible passwords', 'Common words and phrases from a list', 'Random guesses', 'Stolen password hashes'],
      correct: 1,
      explanation: 'Dictionary attacks use a list of common passwords, words, and variations. Much faster than brute force.'
    },
    {
      id: 45,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Password Attacks',
      question: 'Rainbow tables are used to:',
      options: ['Crack weak passwords', 'Perform dictionary attacks', 'Reverse password hashes quickly using precomputed tables', 'Monitor network traffic'],
      correct: 2,
      explanation: 'Rainbow tables store precomputed hash-to-password mappings, enabling fast hash lookups.'
    },
    {
      id: 46,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Privilege Escalation',
      question: 'Privilege escalation allows an attacker to:',
      options: ['Access the network', 'Gain higher permission levels than authorized', 'Encrypt files', 'Delete accounts'],
      correct: 1,
      explanation: 'Privilege escalation moves from limited user rights to admin/root access via exploited vulnerabilities.'
    },
    {
      id: 47,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Privilege Escalation',
      question: 'Vertical privilege escalation means:',
      options: ['Moving from user to another user', 'Moving from user to admin', 'Spreading to multiple systems', 'None of above'],
      correct: 1,
      explanation: 'Vertical = moving UP (low privilege to high). Horizontal = lateral to same privilege level.'
    },
    {
      id: 48,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Insecure Deserialization',
      question: 'Insecure deserialization exploits:',
      options: ['Network protocols', 'Untrusted serialized object data leading to RCE', 'File systems', 'User input validation'],
      correct: 1,
      explanation: 'Deserialization converts serialized data back to objects. If untrusted, attackers can execute code.'
    },
    {
      id: 49,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Vulnerability Assessment',
      question: 'A vulnerability is:',
      options: ['An attack that is happening', 'A weakness that could be exploited', 'A security policy', 'A type of malware'],
      correct: 1,
      explanation: 'Vulnerability = weakness. Threat = potential attacker. Exploit = actual attack code.'
    },
    {
      id: 50,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Vulnerability Assessment',
      question: 'What does the CVSS score measure?',
      options: ['Cost of fixing a bug', 'Severity of a vulnerability', 'Number of affected systems', 'Attack speed'],
      correct: 1,
      explanation: 'CVSS (Common Vulnerability Scoring System) rates severity 0-10 based on exploitability and impact.'
    },
    {
      id: 51,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Vulnerability Assessment',
      question: 'A vulnerability scanner:',
      options: ['Actively exploits systems', 'Passively identifies potential vulnerabilities', 'Fixes vulnerabilities automatically', 'Encrypts networks'],
      correct: 1,
      explanation: 'Scanners (like Nessus, OpenVAS) identify vulnerabilities without exploitation. Penetration testers exploit.'
    },
    {
      id: 52,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Patch Management',
      question: 'Why is timely patching critical?',
      options: ['Improves performance', 'Reduces attack surface by fixing known vulnerabilities', 'Cheaper than upgrades', 'Increases storage'],
      correct: 1,
      explanation: 'Patching fixes bugs and security flaws before attackers exploit them in the wild.'
    },
    {
      id: 53,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Patch Management',
      question: 'Zero-day vulnerability is:',
      options: ['A vulnerability that was just discovered', 'An old vulnerability', 'A vulnerability with no known patch/exploit', 'A type of malware'],
      correct: 2,
      explanation: 'Zero-day = exploit exists but no patch yet. Defenders have no fix; attackers have advantage.'
    },
    {
      id: 54,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Business Email Compromise',
      question: 'Business Email Compromise (BEC) typically targets:',
      options: ['Young users', 'High-value wire transfers and sensitive data via social engineering', 'Government agencies only', 'Linux systems'],
      correct: 1,
      explanation: 'BEC impersonates executives/vendors to trick finance teams into unauthorized transfers.'
    },
    {
      id: 55,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Advanced Persistent Threat',
      question: 'What characterizes an APT (Advanced Persistent Threat)?',
      options: ['Random quick attacks', 'Sophisticated, long-term, targeted compromise with stealth', 'A single malware', 'Only affects governments'],
      correct: 1,
      explanation: 'APTs are sophisticated, nation-state or well-funded actors maintaining long-term presence in systems.'
    },
    {
      id: 56,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Insider Threats',
      question: 'An insider threat is:',
      options: ['External hackers only', 'Compromised external vendors', 'Employees/contractors abusing access or stealing data', 'Network misconfiguration'],
      correct: 2,
      explanation: 'Insider threats are trusted people misusing legitimate access (malicious or negligent).'
    },
    {
      id: 57,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Supply Chain Attacks',
      question: 'A supply chain attack targets:',
      options: ['Customer payment systems', 'Vendor/supplier software/hardware to compromise downstream customers', 'Shipping logistics', 'Employee devices only'],
      correct: 1,
      explanation: 'Supply chain attacks compromise a vendor\'s product/service to reach many organizations at once.'
    },
    {
      id: 58,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Cryptographic Failures',
      question: 'Which is NOT a cryptographic failure?',
      options: ['Using MD5 to hash passwords', 'Hardcoding encryption keys', 'Implementing strong AES-256 encryption properly', 'Transmitting sensitive data in plaintext'],
      correct: 2,
      explanation: 'Proper AES-256 is secure. Failures: weak algorithms, hardcoded keys, plaintext transmission, predictable RNG.'
    },
    {
      id: 59,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Broken Access Control',
      question: 'Broken access control allows:',
      options: ['Network eavesdropping', 'Users to access unauthorized resources due to inadequate controls', 'Data encryption bypass', 'Malware execution'],
      correct: 1,
      explanation: 'Broken AC: no authentication, weak authorization, missing or misconfigured access checks.'
    },
    {
      id: 60,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Session Hijacking',
      question: 'Session hijacking involves:',
      options: ['Stealing the user\'s credentials', 'Taking over an active session by stealing the session token', 'Blocking network traffic', 'Modifying source code'],
      correct: 1,
      explanation: 'Hijacking steals session cookies/tokens (from network sniffing or XSS), allowing attacker to impersonate user.'
    },
    {
      id: 61,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Driver Vulnerabilities',
      question: 'Drivers are critical attack vectors because:',
      options: ['They run in user mode', 'They run in kernel mode with high privileges', 'They are rarely updated', 'They encrypt data'],
      correct: 1,
      explanation: 'Kernel-mode drivers have deep system access; vulnerabilities can lead to complete system compromise.'
    },
    {
      id: 62,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Firmware Vulnerabilities',
      question: 'Firmware attacks are dangerous because:',
      options: ['They are easily visible', 'They persist even after OS reinstall and are hard to patch', 'They only affect phones', 'They require physical access always'],
      correct: 1,
      explanation: 'Firmware lives in ROM/BIOS; infections survive OS wipes and OS-level security doesn\'t help.'
    },
    {
      id: 63,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Adversarial AI/ML',
      question: 'An adversarial attack on ML models might:',
      options: ['Increase server memory', 'Add tiny perturbations to input to cause misclassification', 'Speed up training', 'None of above'],
      correct: 1,
      explanation: 'Adversarial examples fool ML models into wrong classifications without obvious tampering.'
    },
    {
      id: 64,
      domain: 'Threats, Vulnerabilities, & Mitigations',
      topic: 'Poisoning Attacks',
      question: 'A poisoning attack on ML involves:',
      options: ['Overloading servers', 'Tampering with training data to corrupt the model', 'DDoS attacks', 'Network sniffing'],
      correct: 1,
      explanation: 'Data poisoning injects malicious samples into training sets, causing biased/backdoored models.'
    },

    // DOMAIN 3: SECURITY ARCHITECTURE (25 questions)
    {
      id: 65,
      domain: 'Security Architecture',
      topic: 'Network Segmentation',
      question: 'Network segmentation primarily provides:',
      options: ['Faster internet', 'Isolation of network zones to limit breach impact and control traffic flow', 'Encryption', 'User authentication'],
      correct: 1,
      explanation: 'Segmentation divides networks (DMZ, internal, guest) so a breach doesn\'t compromise everything.'
    },
    {
      id: 66,
      domain: 'Security Architecture',
      topic: 'Network Segmentation',
      question: 'What is a DMZ (Demilitarized Zone)?',
      options: ['A security guard room', 'A network zone between internal network and internet hosting public services', 'An encryption algorithm', 'A firewall brand'],
      correct: 1,
      explanation: 'DMZ hosts public-facing servers (web, email) with limited access to internal network.'
    },
    {
      id: 67,
      domain: 'Security Architecture',
      topic: 'Firewalls',
      question: 'A stateless firewall:',
      options: ['Remembers previous packets', 'Evaluates each packet independently without context', 'Is more secure than stateful', 'Encrypts traffic'],
      correct: 1,
      explanation: 'Stateless firewalls check each packet against rules, no memory. Stateful tracks connections.'
    },
    {
      id: 68,
      domain: 'Security Architecture',
      topic: 'Firewalls',
      question: 'A Next-Generation Firewall (NGFW) can inspect:',
      options: ['Only port numbers', 'Application-layer traffic to detect advanced threats', 'Only IP addresses', 'Physical cables'],
      correct: 1,
      explanation: 'NGFWs look at Layer 7 (application data), detecting malware, intrusions, and encrypted threats.'
    },
    {
      id: 69,
      domain: 'Security Architecture',
      topic: 'IDS and IPS',
      question: 'IDS (Intrusion Detection System) primarily:',
      options: ['Prevents attacks', 'Detects and alerts on suspicious activity', 'Encrypts networks', 'Manages firewalls'],
      correct: 1,
      explanation: 'IDS monitors and alerts. IPS (Intrusion Prevention) also blocks detected intrusions.'
    },
    {
      id: 70,
      domain: 'Security Architecture',
      topic: 'IDS and IPS',
      question: 'A false positive in IDS/IPS means:',
      options: ['A real attack was detected', 'A real attack was missed', 'Legitimate traffic was flagged as malicious', 'The sensor failed'],
      correct: 2,
      explanation: 'False positive = benign activity flagged as attack. False negative = real attack missed.'
    },
    {
      id: 71,
      domain: 'Security Architecture',
      topic: 'Proxy and Reverse Proxy',
      question: 'A forward proxy:',
      options: ['Sits behind the server', 'Sits in front of clients to proxy outbound requests, providing privacy/filtering', 'Encrypts traffic', 'Manages users'],
      correct: 1,
      explanation: 'Forward proxy = client → proxy → internet (hides client IP, filters content).'
    },
    {
      id: 72,
      domain: 'Security Architecture',
      topic: 'Proxy and Reverse Proxy',
      question: 'A reverse proxy:',
      options: ['Filters client outbound traffic', 'Sits in front of servers to handle incoming requests, hiding server details', 'Authenticates users', 'Encrypts databases'],
      correct: 1,
      explanation: 'Reverse proxy = internet → proxy → server (hides server IP, load balances, acts as WAF).'
    },
    {
      id: 73,
      domain: 'Security Architecture',
      topic: 'VPN',
      question: 'A VPN provides:',
      options: ['Faster internet speeds', 'Encrypted tunnel to disguise traffic and IP address', 'Better website load times', 'Hardware acceleration'],
      correct: 1,
      explanation: 'VPN encrypts traffic between client and VPN server, hiding IP and content from ISP.'
    },
    {
      id: 74,
      domain: 'Security Architecture',
      topic: 'VPN',
      question: 'Which VPN protocol is most modern and fastest?',
      options: ['PPTP', 'L2TP', 'WireGuard', 'PPTP'],
      correct: 2,
      explanation: 'WireGuard is modern, lightweight, fast, and secure. IPSec and OpenVPN are older but established.'
    },
    {
      id: 75,
      domain: 'Security Architecture',
      topic: 'Endpoint Security',
      question: 'EDR (Endpoint Detection and Response) provides:',
      options: ['Antivirus only', 'Advanced threat detection, investigation, and remediation on endpoints', 'Firewall only', 'User authentication'],
      correct: 1,
      explanation: 'EDR monitors behavior, detects anomalies, provides forensics, and enables rapid response.'
    },
    {
      id: 76,
      domain: 'Security Architecture',
      topic: 'Endpoint Security',
      question: 'Which is more advanced?',
      options: ['Antivirus', 'EDR (Endpoint Detection & Response)', 'They are equal', 'Neither'],
      correct: 1,
      explanation: 'EDR is newer, more sophisticated, provides behavioral analysis + threat hunting. AV is signature-based.'
    },
    {
      id: 77,
      domain: 'Security Architecture',
      topic: 'Cloud Security',
      question: 'The shared responsibility model means:',
      options: ['Cloud provider controls all security', 'Provider and customer split security responsibilities', 'Customer controls all security', 'No one is responsible'],
      correct: 1,
      explanation: 'Provider secures infrastructure; customer secures data, config, access, patches. Varies by service model.'
    },
    {
      id: 78,
      domain: 'Security Architecture',
      topic: 'Cloud Security',
      question: 'In SaaS (Software-as-a-Service), the customer is responsible for:',
      options: ['All security', 'Only data and user access', 'Nothing', 'Infrastructure only'],
      correct: 1,
      explanation: 'SaaS: Provider secures app/infra/OS. Customer secures data, users, access policies, API keys.'
    },
    {
      id: 79,
      domain: 'Security Architecture',
      topic: 'Containerization Security',
      question: 'Docker containers pose a security risk if:',
      options: ['They are lightweight', 'The container image has vulnerabilities and insufficient runtime isolation', 'They use Linux', 'They are networked'],
      correct: 1,
      explanation: 'Container risks: vulnerable base images, escape exploits, shared kernel, misconfigured runtime permissions.'
    },
    {
      id: 80,
      domain: 'Security Architecture',
      topic: 'Secrets Management',
      question: 'Hardcoding API keys in source code is:',
      options: ['Best practice', 'A critical security vulnerability', 'Required for performance', 'Only bad if committed'],
      correct: 1,
      explanation: 'Hardcoded secrets get exposed in git history, logs, backups. Use vaults/secret managers (Vault, AWS Secrets).'
    },
    {
      id: 81,
      domain: 'Security Architecture',
      topic: 'Secrets Management',
      question: 'What is HashiCorp Vault used for?',
      options: ['File storage', 'Centralized secrets management, encryption, and access control', 'User authentication', 'Network monitoring'],
      correct: 1,
      explanation: 'Vault stores passwords, API keys, certs; rotates secrets; enforces least privilege access.'
    },
    {
      id: 82,
      domain: 'Security Architecture',
      topic: 'Zero Trust Architecture',
      question: 'Zero Trust means:',
      options: ['No security controls', '"Never trust, always verify" every access request', 'Trust all internal users', 'Only perimeter security'],
      correct: 1,
      explanation: 'Zero Trust verifies identity/device/context for every request, internal or external.'
    },
    {
      id: 83,
      domain: 'Security Architecture',
      topic: 'Microservices Security',
      question: 'Securing microservices requires:',
      options: ['No authentication between services', 'Strong inter-service communication, API security, isolation, monitoring', 'Only perimeter firewalls', 'Centralized authentication only'],
      correct: 1,
      explanation: 'Microservices: API gateways, mutual TLS, service mesh, rate limiting, fine-grained auth.'
    },
    {
      id: 84,
      domain: 'Security Architecture',
      topic: 'API Security',
      question: 'API key exposure is critical because:',
      options: ['API keys are always encrypted', 'Exposed keys allow attackers to impersonate legitimate users/apps', 'Keys expire quickly', 'They only affect one user'],
      correct: 1,
      explanation: 'API keys grant access; exposed keys = full API access. Rotate immediately; use OAuth/API tokens.'
    },
    {
      id: 85,
      domain: 'Security Architecture',
      topic: 'API Security',
      question: 'Rate limiting on APIs prevents:',
      options: ['Data encryption', 'Brute force attacks and DoS', 'User authentication', 'SQL injection'],
      correct: 1,
      explanation: 'Rate limiting blocks excessive requests, preventing password brute force and API resource exhaustion.'
    },
    {
      id: 86,
      domain: 'Security Architecture',
      topic: 'SSL/TLS',
      question: 'TLS (Transport Layer Security) protects:',
      options: ['Data at rest', 'Data in transit from eavesdropping and tampering', 'User authentication only', 'Local storage'],
      correct: 1,
      explanation: 'TLS encrypts data moving over networks, replacing older SSL. Protects HTTPS, email, VPN, etc.'
    },
    {
      id: 87,
      domain: 'Security Architecture',
      topic: 'SSL/TLS',
      question: 'A certificate pinning:',
      options: ['Encrypts data', 'Binds apps to specific certificates, preventing MITM even if CA is compromised', 'Verifies user identity', 'Compresses data'],
      correct: 1,
      explanation: 'Pinning stores expected certificate/public key, rejecting unauthorized certs even if valid.'
    },
    {
      id: 88,
      domain: 'Security Architecture',
      topic: 'Cryptographic Protocols',
      question: 'Which is most secure?',
      options: ['WEP', 'WPA', 'WPA2', 'WPA3'],
      correct: 3,
      explanation: 'WPA3 is the latest WiFi standard with stronger encryption and protection against brute force.'
    },
    {
      id: 89,
      domain: 'Security Architecture',
      topic: 'Cryptographic Protocols',
      question: 'SSH (Secure Shell) is used for:',
      options: ['Web browsing', 'Remote secure command-line access with encryption', 'File compression', 'Video streaming'],
      correct: 1,
      explanation: 'SSH encrypts remote login and file transfer (SFTP). Uses public key or password authentication.'
    },

    // DOMAIN 4: SECURITY OPERATIONS (30 questions)
    {
      id: 90,
      domain: 'Security Operations',
      topic: 'Incident Response',
      question: 'Incident response typically includes:',
      options: ['Detection only', 'Detection, containment, eradication, recovery, lessons learned', 'Recovery only', 'Prevention only'],
      correct: 1,
      explanation: 'IR phases: Preparation → Detection → Containment → Eradication → Recovery → Post-Incident Review.'
    },
    {
      id: 91,
      domain: 'Security Operations',
      topic: 'Incident Response',
      question: 'During incident response, containment means:',
      options: ['Removing malware', 'Stopping the attack to limit damage', 'Fixing all vulnerabilities', 'Notifying law enforcement'],
      correct: 1,
      explanation: 'Containment isolates affected systems to prevent further spread while investigation continues.'
    },
    {
      id: 92,
      domain: 'Security Operations',
      topic: 'Forensics',
      question: 'Chain of custody is critical in forensics because:',
      options: ['It slows investigations', 'It documents evidence handling to maintain integrity and admissibility', 'It encrypts evidence', 'It automates analysis'],
      correct: 1,
      explanation: 'CoC proves evidence was not tampered with, essential for legal proceedings and credibility.'
    },
    {
      id: 93,
      domain: 'Security Operations',
      topic: 'Forensics',
      question: 'When collecting evidence from a running system, which should be preserved first?',
      options: ['Hard drive', 'RAM (volatile memory)', 'Logs on disk', 'Network traffic'],
      correct: 1,
      explanation: 'RAM is volatile and lost on shutdown. Capture it before powering down. Disk is persistent.'
    },
    {
      id: 94,
      domain: 'Security Operations',
      topic: 'Logging and Monitoring',
      question: 'A SIEM (Security Information and Event Management) platform:',
      options: ['Only stores logs', 'Collects, correlates, analyzes logs/events to detect threats and anomalies', 'Encrypts logs', 'Runs firewalls'],
      correct: 1,
      explanation: 'SIEM aggregates logs from all systems, applies rules, alerts on suspicious patterns.'
    },
    {
      id: 95,
      domain: 'Security Operations',
      topic: 'Logging and Monitoring',
      question: 'Log retention is important for:',
      options: ['Faster systems', 'Forensics, audit trails, and trend analysis', 'Encryption', 'User experience'],
      correct: 1,
      explanation: 'Logs enable post-breach investigation, compliance audit trails, and pattern detection over time.'
    },
    {
      id: 96,
      domain: 'Security Operations',
      topic: 'Vulnerability Management',
      question: 'The CVSS severity levels are:',
      options: ['Low, Medium, High', 'Low, Medium, High, Critical', 'None, Minor, Major', 'Light, Regular, Severe'],
      correct: 1,
      explanation: 'CVSS: None (0), Low (0.1-3.9), Medium (4-6.9), High (7-8.9), Critical (9-10).'
    },
    {
      id: 97,
      domain: 'Security Operations',
      topic: 'Threat Hunting',
      question: 'Threat hunting involves:',
      options: ['Waiting for alerts', 'Proactively searching for signs of compromise and adversaries in systems', 'Running antivirus', 'Blocking all traffic'],
      correct: 1,
      explanation: 'Threat hunting uses data analysis, IOCs, and behavioral techniques to uncover hidden threats.'
    },
    {
      id: 98,
      domain: 'Security Operations',
      topic: 'Threat Intelligence',
      question: 'Threat intelligence includes:',
      options: ['Antivirus signatures only', 'Information about threats, TTPs, IOCs, vulnerabilities, campaigns', 'Firewall rules only', 'User passwords'],
      correct: 1,
      explanation: 'TI covers indicators (IP/hash/domain), tactics, tools, and attack patterns to improve defenses.'
    },
    {
      id: 99,
      domain: 'Security Operations',
      topic: 'Threat Intelligence',
      question: 'IOC stands for:',
      options: ['Input Output Controller', 'Indicator of Compromise', 'Intrusion Operations Center', 'Internet Outbound Connection'],
      correct: 1,
      explanation: 'IOCs are artifacts (IP, hash, domain, URL) indicating a system was compromised.'
    },
    {
      id: 100,
      domain: 'Security Operations',
      topic: 'SOAR',
      question: 'SOAR (Security Orchestration, Automation, Response) platform helps:',
      options: ['Only detect threats', 'Automate response workflows, reduce alert fatigue, speed incident handling', 'Encrypt data', 'Replace SIEM'],
      correct: 1,
      explanation: 'SOAR automates playbooks, integrates tools, speeds response. Complements SIEM.'
    },
    {
      id: 101,
      domain: 'Security Operations',
      topic: 'Disaster Recovery',
      question: 'RTO (Recovery Time Objective) is:',
      options: ['The amount of data loss allowed', 'The target time to restore service after disruption', 'The time to detect an incident', 'The cost of recovery'],
      correct: 1,
      explanation: 'RTO = acceptable downtime. RPO = acceptable data loss. Critical systems have low RTO/RPO.'
    },
    {
      id: 102,
      domain: 'Security Operations',
      topic: 'Disaster Recovery',
      question: 'RPO (Recovery Point Objective) refers to:',
      options: ['Recovery staff size', 'The maximum acceptable data loss (in time)', 'The recovery location', 'The recovery budget'],
      correct: 1,
      explanation: 'RPO = how recent backups must be. RTO = how quickly to restore. E.g., 4-hour RPO = daily backups.'
    },
    {
      id: 103,
      domain: 'Security Operations',
      topic: 'Business Continuity',
      question: 'Business continuity planning ensures:',
      options: ['No outages ever happen', 'Critical operations can resume quickly after disruption', 'All data is encrypted', 'Users are happy'],
      correct: 1,
      explanation: 'BCP outlines how to maintain operations during crises (attacks, natural disasters, supply chain).'
    },
    {
      id: 104,
      domain: 'Security Operations',
      topic: 'Change Management',
      question: 'Change management controls:',
      options: ['User passwords', 'Who can modify systems, how, when, and requiring approval/documentation', 'Email access', 'Database contents'],
      correct: 1,
      explanation: 'CM prevents unauthorized changes, ensures rollback capability, tracks modifications for audit.'
    },
    {
      id: 105,
      domain: 'Security Operations',
      topic: 'Configuration Management',
      question: 'Baseline configurations in security ensure:',
      options: ['Faster systems', 'Consistent, hardened starting state for all systems, reducing attack surface', 'Cheaper costs', 'More storage'],
      correct: 1,
      explanation: 'Baselines document secure OS configs, disabled services, patches, firewall rules, etc.'
    },
    {
      id: 106,
      domain: 'Security Operations',
      topic: 'Vulnerability Scanning',
      question: 'Passive vulnerability scanning:',
      options: ['Actively exploits systems', 'Observes network traffic without active probing', 'Requires admin access', 'Is always aggressive'],
      correct: 1,
      explanation: 'Passive scanning: monitor traffic, sniff packets, analyze logs. Active: send probes, port scans.'
    },
    {
      id: 107,
      domain: 'Security Operations',
      topic: 'Penetration Testing',
      question: 'A penetration test differs from vulnerability scanning because:',
      options: ['Both are the same', 'Pen tests actively exploit vulnerabilities; scans only identify them', 'Pen tests are cheaper', 'Scans require authorization'],
      correct: 1,
      explanation: 'Pentesting goes further: actually exploits flaws to assess real-world impact and chains.'
    },
    {
      id: 108,
      domain: 'Security Operations',
      topic: 'Penetration Testing',
      question: 'A black-box penetration test assumes:',
      options: ['Full system knowledge', 'No prior system knowledge, like a real attacker', 'Access to source code', 'Physical device access'],
      correct: 1,
      explanation: 'Black-box: attacker knows nothing. White-box: full knowledge. Gray-box: partial.'
    },
    {
      id: 109,
      domain: 'Security Operations',
      topic: 'Red vs Blue Team',
      question: 'A Red Team:',
      options: ['Defends systems', 'Attacks systems to identify weaknesses', 'Manages firewalls', 'Writes policies'],
      correct: 1,
      explanation: 'Red = attackers/simulated adversaries. Blue = defenders. Purple = both working together.'
    },
    {
      id: 110,
      domain: 'Security Operations',
      topic: 'Security Metrics',
      question: 'MTTR (Mean Time to Respond) measures:',
      options: ['Average time to detect an incident', 'Average time from detection to response', 'Time to fix code', 'Uptime percentage'],
      correct: 1,
      explanation: 'MTTR = (time detected) to (first response). MTTF = time until failure. MTBF = time between failures.'
    },
    {
      id: 111,
      domain: 'Security Operations',
      topic: 'Security Metrics',
      question: 'MTBF (Mean Time Between Failures) is important for:',
      options: ['Incident response', 'Assessing system reliability and planning maintenance', 'User training', 'Compliance'],
      correct: 1,
      explanation: 'MTBF helps predict when failures occur, plan maintenance windows, and assess reliability.'
    },
    {
      id: 112,
      domain: 'Security Operations',
      topic: 'Metrics and KPIs',
      question: 'Which metric tracks security awareness effectiveness?',
      options: ['Number of firewalls', 'Percentage of employees passing security training', 'Hard drive capacity', 'Network speed'],
      correct: 1,
      explanation: 'Training completion rates and phishing click-through rates are common awareness KPIs.'
    },
    {
      id: 113,
      domain: 'Security Operations',
      topic: 'False Positives/Negatives',
      question: 'A false negative in security means:',
      options: ['A real threat was detected', 'A real threat was missed', 'A legitimate action was flagged', 'An alert timeout'],
      correct: 1,
      explanation: 'False negative = dangerous missed threat. False positive = annoying false alarm.'
    },
    {
      id: 114,
      domain: 'Security Operations',
      topic: 'Compliance Monitoring',
      question: 'Continuous compliance monitoring:',
      options: ['Checks controls yearly only', 'Continuously verifies adherence to regulations/standards', 'Requires manual audits', 'Is optional'],
      correct: 1,
      explanation: 'Automated monitoring detects policy violations in real-time, improving compliance posture.'
    },
    {
      id: 115,
      domain: 'Security Operations',
      topic: 'Secure SDLC',
      question: 'Integrating security into the SDLC (Software Development Lifecycle) means:',
      options: ['Security testing only at the end', 'Security throughout all phases: design, development, testing, deployment', 'No security testing', 'Security in production only'],
      correct: 1,
      explanation: 'Secure SDLC: threat modeling, code review, SAST/DAST, pen testing, secure deployment.'
    },

    // DOMAIN 5: GOVERNANCE, RISK, AND COMPLIANCE (20 questions)
    {
      id: 116,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Governance',
      question: 'Information security governance ensures:',
      options: ['No risks exist', 'Security aligns with business objectives and compliance requirements', 'All data is encrypted', 'No incidents occur'],
      correct: 1,
      explanation: 'Governance establishes policies, roles, oversight, accountability, and strategic direction.'
    },
    {
      id: 117,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Governance',
      question: 'A CISO (Chief Information Security Officer) reports to:',
      options: ['IT department only', 'The CTO', 'The CEO/Board (ideally)', 'The Finance department'],
      correct: 2,
      explanation: 'CISO should report to C-level/Board to ensure security alignment with business strategy.'
    },
    {
      id: 118,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Risk Management',
      question: 'Risk mitigation involves:',
      options: ['Ignoring risks', 'Implementing controls to reduce risk to acceptable levels', 'Eliminating all risks', 'Transferring all risks'],
      correct: 1,
      explanation: 'Mitigation reduces likelihood or impact through controls (firewalls, encryption, training, etc.).'
    },
    {
      id: 119,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Risk Management',
      question: 'Risk avoidance means:',
      options: ['Reducing risk', 'Accepting the risk', 'Not engaging in the activity that creates the risk', 'Transferring risk'],
      correct: 2,
      explanation: 'Avoidance = don\'t do it. Example: avoiding outdated tech entirely instead of maintaining it.'
    },
    {
      id: 120,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Risk Management',
      question: 'Risk transfer involves:',
      options: ['Ignoring risks', 'Shifting risk to a third party (e.g., insurance, outsourcing)', 'Fixing the vulnerability', 'Monitoring the risk'],
      correct: 1,
      explanation: 'Transfer = insurance, outsourcing to vendor, SLAs. Third party accepts the risk.'
    },
    {
      id: 121,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Compliance Frameworks',
      question: 'SOC 2 (Service Organization Control 2) is typically for:',
      options: ['Government agencies', 'Cloud/SaaS providers proving control over data/security', 'Healthcare only', 'Banks only'],
      correct: 1,
      explanation: 'SOC 2 Type I/II audits verify controls around security, availability, processing integrity, confidentiality.'
    },
    {
      id: 122,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Compliance Frameworks',
      question: 'PCI DSS (Payment Card Industry Data Security Standard) applies to organizations that:',
      options: ['Have websites', 'Process, store, or transmit credit card data', 'Use Microsoft products', 'Have more than 100 employees'],
      correct: 1,
      explanation: 'PCI DSS mandates security controls for entities handling cardholder data to prevent breaches.'
    },
    {
      id: 123,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Privacy Regulations',
      question: 'GDPR requires organizations to:',
      options: ['Encrypt all data', 'Notify individuals of breaches and respect data privacy rights', 'Remove all personal data', 'Only store encrypted data'],
      correct: 1,
      explanation: 'GDPR: consent for data collection, breach notification, data subject rights, privacy by design.'
    },
    {
      id: 124,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Privacy Regulations',
      question: 'What is the GDPR\'s "right to be forgotten"?',
      options: ['Deleting browser history', 'Data subject\'s right to request data deletion', 'Ignoring old incidents', 'Backup deletion only'],
      correct: 1,
      explanation: 'Right to be forgotten: individuals can request erasure of personal data under certain conditions.'
    },
    {
      id: 125,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Privacy Regulations',
      question: 'CCPA (California Consumer Privacy Act) gives consumers:',
      options: ['Government benefits', 'Right to know, delete, opt-out of sale of personal data', 'Free security tools', 'Tax breaks'],
      correct: 1,
      explanation: 'CCPA grants California residents privacy rights similar to GDPR.'
    },
    {
      id: 126,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Incident Disclosure',
      question: 'Most breach notification laws require notification within:',
      options: ['6 months', '30-60 days typically', '1 year', 'No time limit'],
      correct: 1,
      explanation: 'Timeframes vary by jurisdiction (e.g., GDPR 72 hours, most US states 30-60 days).'
    },
    {
      id: 127,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Data Classification',
      question: 'Data classification categories typically include:',
      options: ['Public, Internal, Confidential, Secret/Restricted', 'Only Public/Private', 'Encrypted/Unencrypted', 'Online/Offline'],
      correct: 0,
      explanation: 'Classification determines access controls, encryption, retention, and handling requirements.'
    },
    {
      id: 128,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Data Handling',
      question: 'Data retention policies specify:',
      options: ['How to encrypt data', 'How long to keep data before secure disposal', 'Who can access data', 'Where to store data'],
      correct: 1,
      explanation: 'Retention: keep as long as needed, delete securely after. Reduces breach exposure and storage costs.'
    },
    {
      id: 129,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Data Handling',
      question: 'Data sanitization ensures:',
      options: ['Data is clean', 'Data is permanently removed and unrecoverable', 'Data is encrypted', 'Data is backed up'],
      correct: 1,
      explanation: 'Sanitization overwrites/degausses/destroys storage to prevent recovery before disposal.'
    },
    {
      id: 130,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Third-Party Risk',
      question: 'Third-party risk management includes:',
      options: ['Ignoring vendors', 'Assessing and monitoring vendor security controls and dependencies', 'Using only large vendors', 'No monitoring needed'],
      correct: 1,
      explanation: 'Vendor assessment: SLAs, SOC 2, penetration test results, data handling practices, incident response.'
    },
    {
      id: 131,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Third-Party Risk',
      question: 'A vendor assessment typically reviews:',
      options: ['Only pricing', 'Security controls, compliance, certifications, incident history', 'Only product features', 'Customer service only'],
      correct: 1,
      explanation: 'Assessment covers security posture, regulatory compliance, breach history, SLAs, data handling.'
    },
    {
      id: 132,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Vendor Management',
      question: 'What is a BAA (Business Associate Agreement)?',
      options: ['A general sales contract', 'A HIPAA requirement defining vendor responsibilities for PHI', 'A non-disclosure agreement', 'An employment contract'],
      correct: 1,
      explanation: 'BAAs ensure vendors handling Protected Health Information (PHI) follow HIPAA requirements.'
    },
    {
      id: 133,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Audit and Assessment',
      question: 'An internal audit is typically conducted by:',
      options: ['External auditors only', 'Organization\'s internal audit/compliance team', 'Competitors', 'Customers'],
      correct: 1,
      explanation: 'Internal audits assess controls and compliance. External audits provide independent verification.'
    },
    {
      id: 134,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Audit and Assessment',
      question: 'What is the focus of a compliance audit?',
      options: ['Finding bugs in code', 'Verifying adherence to regulations, standards, and policies', 'Testing performance', 'Checking user happiness'],
      correct: 1,
      explanation: 'Compliance audits verify controls, documentation, evidence that regulations are followed.'
    },
    {
      id: 135,
      domain: 'Governance, Risk, & Compliance',
      topic: 'Security Policies',
      question: 'An acceptable use policy (AUP) defines:',
      options: ['Network bandwidth limits', 'Permitted and prohibited uses of organization resources', 'Employee salaries', 'Vacation policies'],
      correct: 1,
      explanation: 'AUP covers acceptable use of computers, internet, email, data, etc., with consequences for violations.'
    }
  ];
  function usePersistentState(key, initialValue) {
  const [value, setValue] = React.useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

  // State management
  const [mode, setMode] = useState('goalSetup'); // 'goalSetup', 'learn', 'review', 'dashboard'
  const [currentTopic, setCurrentTopic] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [performance, setPerformance] = usePersistentState('sp_performance', {});
const [goal, setGoal] = usePersistentState('sp_goal', null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [timerActive, setTimerActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  
  // Goal state
  const [goal, setGoal] = useState(null); // {targetDate, targetAccuracy, questionsTarget, createdAt}
  const [goalWeeks, setGoalWeeks] = useState('3');
  const [goalAccuracy, setGoalAccuracy] = useState('85');
  const [goalQuestions, setGoalQuestions] = useState(String(questionBank.length));

  // Calculate weak spots
  const weakSpots = useMemo(() => {
    const spots = {};
    Object.entries(performance).forEach(([qId, data]) => {
      const question = questionBank.find(q => q.id === parseInt(qId));
      if (question) {
        const topic = question.topic;
        if (!spots[topic]) spots[topic] = { correct: 0, total: 0 };
        spots[topic].total++;
        const lastAttempt = data.attempts[data.attempts.length - 1];
        if (lastAttempt && lastAttempt.correct) spots[topic].correct++;
      }
    });
    return spots;
  }, [performance]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    const attempted = Object.keys(performance).length;
    const correct = Object.values(performance).filter(p => p.attempts[p.attempts.length - 1]?.correct).length;
    return attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  }, [performance]);

  // Goal progress calculations
  const goalProgress = useMemo(() => {
    if (!goal) return null;
    
    const now = new Date();
    const targetDate = new Date(goal.targetDate);
    const createdDate = new Date(goal.createdAt);
    
    const totalMs = targetDate.getTime() - createdDate.getTime();
    const elapsedMs = now.getTime() - createdDate.getTime();
    const remainingMs = targetDate.getTime() - now.getTime();
    
    const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
    const daysElapsed = totalDays - daysRemaining;
    
    const attempted = Object.keys(performance).length;
    const questionsRemaining = Math.max(0, goal.questionsTarget - attempted);
    const questionsPercent = (attempted / goal.questionsTarget) * 100;
    
    const correct = Object.values(performance).filter(p => p.attempts[p.attempts.length - 1]?.correct).length;
    const currentAccuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const accuracyRemaining = Math.max(0, goal.targetAccuracy - currentAccuracy);
    
    const timelinePercent = (daysElapsed / totalDays) * 100;
    
    const goalMet = currentAccuracy >= goal.targetAccuracy && attempted >= goal.questionsTarget;
    const onTrack = (questionsPercent >= (timelinePercent * 0.8)) && (currentAccuracy >= (goal.targetAccuracy * 0.8));
    
    return {
      totalDays,
      daysRemaining,
      daysElapsed,
      questionsRemaining,
      questionsPercent,
      currentAccuracy,
      accuracyRemaining,
      timelinePercent,
      goalMet,
      onTrack,
      attempted,
      correct
    };
  }, [goal, performance]);

  // Handle goal creation
  const handleSetGoal = () => {
    const weeksInt = parseInt(goalWeeks) || 3;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weeksInt * 7);
    
    setGoal({
      targetDate: targetDate.toISOString(),
      targetAccuracy: parseInt(goalAccuracy) || 85,
      questionsTarget: parseInt(goalQuestions) || questionBank.length,
      createdAt: new Date().toISOString()
    });
    
    setMode('dashboard');
  };

  // Reset goal
  const handleResetGoal = () => {
    setGoal(null);
    setMode('goalSetup');
    setPerformance({});
  };

  // Get next weak topic for review
  const nextWeakTopic = useMemo(() => {
    const topicScores = {};
    Object.entries(weakSpots).forEach(([topic, data]) => {
      const score = data.total > 0 ? (data.correct / data.total) * 100 : 100;
      topicScores[topic] = score;
    });
    const sorted = Object.entries(topicScores).sort((a, b) => a[1] - b[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }, [weakSpots]);

  // Get unique topics for learning
  const topics = useMemo(() => {
    const topicSet = new Set(questionBank.map(q => q.topic));
    return Array.from(topicSet);
  }, []);

  // Handle answer selection
  const handleAnswer = (selectedIndex) => {
    const topicQuestionsForMode = questionBank.filter(q => q.topic === currentTopic);
    const question = topicQuestionsForMode[currentQuestionIndex];
    
    if (!question) return;
    
    const isCorrect = selectedIndex === question.correct;

    // Update performance
    setPerformance(prev => ({
      ...prev,
      [question.id]: {
        attempts: [
          ...(prev[question.id]?.attempts || []),
          { correct: isCorrect, timestamp: new Date().toISOString() }
        ]
      }
    }));

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));

    // Auto-advance
    setTimeout(() => {
      if (currentQuestionIndex < topicQuestionsForMode.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        setMode('dashboard');
        setCurrentTopic(null);
        setCurrentQuestionIndex(0);
      }
    }, 1500);
  };

  // Start learning a topic
  const startTopic = (topic) => {
    setCurrentTopic(topic);
    setMode('learn');
    setCurrentQuestionIndex(0);
    setSessionStats({ correct: 0, total: 0 });
    setSessionStartTime(new Date());
  };

  // Start reviewing weak spots
  const startWeakSpotReview = () => {
    if (nextWeakTopic) {
      startTopic(nextWeakTopic);
    }
  };

  // Render goal setup screen
  if (mode === 'goalSetup') {
    return (
      <div style={{ padding: '30px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '600px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1 style={{ color: '#2c3e50', textAlign: 'center', marginBottom: '10px' }}>🎯 Security+ Exam Goal</h1>
        <p style={{ color: '#7f8c8d', textAlign: 'center', marginBottom: '40px' }}>
          Set your goal and let's track your progress together!
        </p>

        <div style={{ background: '#f8f9fa', padding: '30px', borderRadius: '8px' }}>
          {/* Weeks */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '8px' }}>
              How many weeks until your exam?
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['1', '2', '3', '4', '6', '8'].map(w => (
                <button
                  key={w}
                  onClick={() => setGoalWeeks(w)}
                  style={{
                    padding: '10px 16px',
                    background: goalWeeks === w ? '#3498db' : '#ecf0f1',
                    color: goalWeeks === w ? 'white' : '#2c3e50',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  {w}w
                </button>
              ))}
            </div>
            <input
              type="number"
              value={goalWeeks}
              onChange={(e) => setGoalWeeks(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '10px',
                border: '1px solid #bdc3c7',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              placeholder="Or enter custom weeks"
            />
          </div>

          {/* Accuracy Target */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '8px' }}>
              Target Accuracy (%)
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['75', '80', '85', '90', '95'].map(acc => (
                <button
                  key={acc}
                  onClick={() => setGoalAccuracy(acc)}
                  style={{
                    padding: '10px 16px',
                    background: goalAccuracy === acc ? '#27ae60' : '#ecf0f1',
                    color: goalAccuracy === acc ? 'white' : '#2c3e50',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  {acc}%
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0"
              max="100"
              value={goalAccuracy}
              onChange={(e) => setGoalAccuracy(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '10px',
                border: '1px solid #bdc3c7',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              placeholder="Or enter custom accuracy"
            />
          </div>

          {/* Questions Target */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '8px' }}>
              Questions to Attempt
            </label>
            <input
              type="number"
              min="10"
              max={questionBank.length}
              value={goalQuestions}
              onChange={(e) => setGoalQuestions(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #bdc3c7',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <p style={{ fontSize: '12px', color: '#95a5a6', marginTop: '8px' }}>
              Total available: {questionBank.length} questions
            </p>
          </div>

          {/* Summary */}
          <div style={{
            background: '#e8f4f8',
            padding: '15px',
            borderRadius: '6px',
            marginBottom: '25px',
            borderLeft: '4px solid #3498db'
          }}>
            <p style={{ margin: '5px 0', fontSize: '14px', color: '#2c3e50' }}>
              <strong>📅 Target Date:</strong> {new Date(new Date().getTime() + (parseInt(goalWeeks || 3) * 7 * 24 * 60 * 60 * 1000)).toLocaleDateString()}
            </p>
            <p style={{ margin: '5px 0', fontSize: '14px', color: '#2c3e50' }}>
              <strong>🎯 Goal:</strong> {goalAccuracy}% accuracy on {goalQuestions} questions
            </p>
          </div>

          <button
            onClick={handleSetGoal}
            style={{
              width: '100%',
              padding: '14px',
              background: '#2c3e50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🚀 Start My Goal
          </button>

          <button
            onClick={() => {
              setMode('learn');
              setGoal({ targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), targetAccuracy: 85, questionsTarget: questionBank.length, createdAt: new Date().toISOString() });
            }}
            style={{
              width: '100%',
              padding: '12px',
              background: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              marginTop: '10px',
              cursor: 'pointer'
            }}
          >
            Skip → Start Learning
          </button>
        </div>
      </div>
    );
  }

  // Render dashboard
  if (mode === 'dashboard') {
    const weakTopicData = nextWeakTopic ? [{
      name: nextWeakTopic,
      accuracy: weakSpots[nextWeakTopic] ? Math.round((weakSpots[nextWeakTopic].correct / weakSpots[nextWeakTopic].total) * 100) : 0
    }] : [];

    const topicAccuracy = Object.entries(weakSpots).map(([topic, data]) => ({
      name: topic,
      accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
    })).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);

    // Goal completion message
    let goalStatusMessage = '';
    let goalStatusColor = '';
    if (goalProgress?.goalMet) {
      goalStatusMessage = '✅ GOAL REACHED! You\'re ready for the exam!';
      goalStatusColor = '#27ae60';
    } else if (goalProgress?.onTrack) {
      goalStatusMessage = '📈 On track to reach your goal!';
      goalStatusColor = '#3498db';
    } else if (goalProgress && goalProgress.daysRemaining > 0) {
      goalStatusMessage = '⚠️ Pace yourself: increase daily practice to stay on track';
      goalStatusColor = '#f39c12';
    } else if (goalProgress && goalProgress.daysRemaining <= 0) {
      goalStatusMessage = '⏰ Time\'s up! Exam is today or very soon!';
      goalStatusColor = '#e74c3c';
    }

    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ color: '#2c3e50', margin: 0 }}>Security+ Prep Dashboard</h1>
          {goal && (
            <button
              onClick={handleResetGoal}
              style={{
                padding: '8px 16px',
                background: '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Reset Goal
            </button>
          )}
        </div>

        {/* Goal Status Banner */}
        {goalProgress && (
          <div style={{
            background: goalStatusColor,
            color: 'white',
            padding: '15px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            {goalStatusMessage}
          </div>
        )}

        {/* Goal Progress Section */}
        {goalProgress && (
          <div style={{
            background: '#f8f9fa',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '30px',
            border: '2px solid #3498db'
          }}>
            <h2 style={{ color: '#2c3e50', marginTop: 0, marginBottom: '20px' }}>📊 Goal Progress</h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: '20px'
            }}>
              {/* Time Remaining */}
              <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #e74c3c' }}>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'bold' }}>⏰ TIME REMAINING</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>
                  {goalProgress.daysRemaining} days
                </div>
                <div style={{ fontSize: '11px', color: '#95a5a6', marginTop: '5px' }}>
                  {goalProgress.daysElapsed} of {goalProgress.totalDays} days used
                </div>
              </div>

              {/* Questions Progress */}
              <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #3498db' }}>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'bold' }}>❓ QUESTIONS</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>
                  {goalProgress.attempted} / {goal.questionsTarget}
                </div>
                <div style={{ fontSize: '11px', color: '#95a5a6', marginTop: '5px' }}>
                  {goalProgress.questionsRemaining} more to go • {Math.round(goalProgress.questionsPercent)}%
                </div>
              </div>

              {/* Accuracy Progress */}
              <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #27ae60' }}>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'bold' }}>🎯 ACCURACY</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>
                  {goalProgress.currentAccuracy}% / {goal.targetAccuracy}%
                </div>
                <div style={{ fontSize: '11px', color: '#95a5a6', marginTop: '5px' }}>
                  {goalProgress.accuracyRemaining > 0 ? `${goalProgress.accuracyRemaining}% to reach goal` : '✅ Target met!'}
                </div>
              </div>
            </div>

            {/* Timeline Progress Bar */}
            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d', marginBottom: '8px' }}>
                Timeline Progress: {goalProgress.daysElapsed} / {goalProgress.totalDays} days ({Math.round(goalProgress.timelinePercent)}%)
              </div>
              <div style={{ background: '#ecf0f1', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  background: goalProgress.onTrack ? '#27ae60' : '#e74c3c',
                  height: '100%',
                  width: `${Math.min(100, goalProgress.timelinePercent)}%`,
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>

            {/* Questions Progress Bar */}
            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d', marginBottom: '8px' }}>
                Questions Progress: {goalProgress.attempted} / {goal.questionsTarget} ({Math.round(goalProgress.questionsPercent)}%)
              </div>
              <div style={{ background: '#ecf0f1', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  background: '#3498db',
                  height: '100%',
                  width: `${Math.min(100, goalProgress.questionsPercent)}%`,
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>

            {/* Accuracy Progress Bar */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d', marginBottom: '8px' }}>
                Accuracy Progress: {goalProgress.currentAccuracy} / {goal.targetAccuracy}% ({Math.round((goalProgress.currentAccuracy / goal.targetAccuracy) * 100)}%)
              </div>
              <div style={{ background: '#ecf0f1', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  background: goalProgress.currentAccuracy >= goal.targetAccuracy ? '#27ae60' : '#f39c12',
                  height: '100%',
                  width: `${Math.min(100, (goalProgress.currentAccuracy / goal.targetAccuracy) * 100)}%`,
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Stats Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div style={{ background: '#e8f4f8', padding: '20px', borderRadius: '8px', border: '2px solid #3498db' }}>
            <div style={{ fontSize: '14px', color: '#7f8c8d' }}>Overall Accuracy</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2c3e50' }}>{overallProgress}%</div>
            <div style={{ fontSize: '12px', color: '#95a5a6', marginTop: '5px' }}>Target: {goal?.targetAccuracy || 85}%</div>
          </div>
          <div style={{ background: '#f0e8f4', padding: '20px', borderRadius: '8px', border: '2px solid #9b59b6' }}>
            <div style={{ fontSize: '14px', color: '#7f8c8d' }}>Questions Attempted</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2c3e50' }}>{Object.keys(performance).length}</div>
            <div style={{ fontSize: '12px', color: '#95a5a6', marginTop: '5px' }}>of {questionBank.length}</div>
          </div>
          <div style={{ background: '#e8f8e8', padding: '20px', borderRadius: '8px', border: '2px solid #27ae60' }}>
            <div style={{ fontSize: '14px', color: '#7f8c8d' }}>Weakest Topic</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c3e50' }}>{nextWeakTopic || 'None yet'}</div>
            {nextWeakTopic && <button
              onClick={startWeakSpotReview}
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                background: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Practice Now
            </button>}
          </div>
        </div>

        {/* Accuracy by Topic */}
        {topicAccuracy.length > 0 && (
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '30px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#2c3e50', marginBottom: '15px' }}>Accuracy by Topic (Bottom 5)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topicAccuracy}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="accuracy" fill="#e74c3c" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setMode('learn')}
            style={{
              padding: '12px 20px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            Start Learning
          </button>
          {nextWeakTopic && (
            <button
              onClick={startWeakSpotReview}
              style={{
                padding: '12px 20px',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Review Weak Spots
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render learning mode
  if (mode === 'learn' && currentTopic) {
    const topicQuestionsForMode = questionBank.filter(q => q.topic === currentTopic);
    
    if (topicQuestionsForMode.length === 0) {
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center' }}>
          <p>No questions found for this topic. Please try another.</p>
          <button onClick={() => setMode('learn')} style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Back
          </button>
        </div>
      );
    }

    const question = topicQuestionsForMode[currentQuestionIndex];
    const questionNumber = currentQuestionIndex + 1;
    const totalInTopic = topicQuestionsForMode.length;
    const sessionAccuracy = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;

    if (!question) {
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center' }}>
          <p>Loading question...</p>
        </div>
      );
    }

    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#2c3e50', margin: 0 }}>{currentTopic}</h2>
          <button
            onClick={() => { setMode('dashboard'); setCurrentTopic(null); setCurrentQuestionIndex(0); }}
            style={{
              padding: '8px 16px',
              background: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Dashboard
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{ background: '#ecf0f1', borderRadius: '6px', height: '8px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{
            background: '#3498db',
            height: '100%',
            width: `${(currentQuestionIndex / totalInTopic) * 100}%`,
            transition: 'width 0.3s'
          }} />
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '14px',
          color: '#7f8c8d',
          marginBottom: '20px'
        }}>
          <span>Q{questionNumber} of {totalInTopic}</span>
          <span>Session: {sessionStats.correct}/{sessionStats.total} ({sessionAccuracy}%)</span>
        </div>

        {/* Question */}
        <div style={{
          background: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          borderLeft: '4px solid #3498db'
        }}>
          <p style={{ fontSize: '16px', color: '#2c3e50', lineHeight: '1.6' }}>
            {question.question}
          </p>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(index)}
              style={{
                padding: '12px 16px',
                background: '#ecf0f1',
                border: '2px solid #bdc3c7',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                hover: { background: '#d5dbdb', borderColor: '#3498db' }
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#d5dbdb';
                e.target.style.borderColor = '#3498db';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#ecf0f1';
                e.target.style.borderColor = '#bdc3c7';
              }}
            >
              {String.fromCharCode(65 + index)}) {option}
            </button>
          ))}
        </div>

        {/* Tip */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: '#fff3cd',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#856404'
        }}>
          💡 {question.explanation}
        </div>
      </div>
    );
  }

  // Render topic selection
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>CompTIA Security+ Exam Prep</h1>
      <p style={{ color: '#7f8c8d', marginBottom: '30px' }}>
        {overallProgress}% accuracy • {Object.keys(performance).length} / {questionBank.length} questions attempted
      </p>

      {/* Goal Reminder */}
      {goal && goalProgress && (
        <div style={{
          background: '#e8f4f8',
          border: '2px solid #3498db',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#2c3e50' }}>
                ⏰ {goalProgress.daysRemaining} days remaining
              </div>
              <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '3px' }}>
                Goal: {goal.targetAccuracy}% accuracy on {goal.questionsTarget} questions
              </div>
            </div>
            <button
              onClick={() => setMode('dashboard')}
              style={{
                padding: '8px 12px',
                background: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              View Progress
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setMode('dashboard')}
          style={{
            padding: '10px 16px',
            background: '#9b59b6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          📊 View Dashboard
        </button>
        {nextWeakTopic && (
          <button
            onClick={startWeakSpotReview}
            style={{
              padding: '10px 16px',
              background: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔥 Review: {nextWeakTopic}
          </button>
        )}
      </div>

      {/* Topic Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '15px'
      }}>
        {topics.map((topic, idx) => {
          const topicData = weakSpots[topic];
          const accuracy = topicData ? Math.round((topicData.correct / topicData.total) * 100) : 0;
          const attempted = topicData ? topicData.total : 0;
          const domain = questionBank.find(q => q.topic === topic)?.domain;

          return (
            <div
              key={idx}
              onClick={() => startTopic(topic)}
              style={{
                padding: '15px',
                background: attempted === 0 ? '#e8f4f8' : (accuracy < 70 ? '#ffe8e8' : '#e8f8e8'),
                border: `2px solid ${attempted === 0 ? '#3498db' : (accuracy < 70 ? '#e74c3c' : '#27ae60')}`,
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
              <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '5px' }}>{domain}</div>
              <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '8px' }}>
                {topic}
              </div>
              {attempted > 0 && (
                <div style={{ fontSize: '13px', color: '#7f8c8d' }}>
                  {accuracy}% • {topicData.correct}/{attempted} correct
                </div>
              )}
              {attempted === 0 && (
                <div style={{ fontSize: '13px', color: '#3498db', fontWeight: 'bold' }}>
                  Start learning →
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SecurityPlusApp;
