# Security+ Study App — Project Guide for Claude

Personal study app for CompTIA Security+ **SY0-701**. Spaced-repetition flashcards with
exam-style questions (MCQ, multi-select, PBQ drag/match). Single user: Elina.
Live: https://security-certification.vercel.app/study

## Stack
- Next.js (App Router) on Vercel
- Neon Postgres + Drizzle ORM (migrations are tracked, never edit applied migrations)
- ts-fsrs for scheduling (ratings derived from response time)
- @dnd-kit for PBQ drag/match questions
- Anthropic API; model IDs live ONLY in `src/lib/ai-models.ts`
  (Sonnet = content generation, Haiku = runtime features)

## Commands
<!-- VERIFY these match package.json, then delete this comment -->
- `npm run dev` — local dev server
- `npm run build` — production build (run before saying a task is done)
- `npm run lint` — ESLint
- `npx tsc --noEmit` — type check
- `npx drizzle-kit generate` — create a migration after schema changes
- `npx drizzle-kit migrate` — apply migrations

## Content rules (the important part)
- Target exam is SY0-701. Never use SY0-601 material. SY0-801 is out of scope.
- Keep official SY0-701 domain weights. Domain 5 is named
  "Security Program Management and Oversight" (not "GRC").
- Questions are scenario-style, like the real exam. Every card needs:
  correct answer(s), an explanation, and a short explanation for EACH distractor.
- Each 15-card session must contain at least 4 multi-select questions. Don't break this.
- New AI-generated cards go into the approval queue as pending. Never insert them as active.
- Answers must stay hidden until the user answers (this was verified — don't regress it).

## Code rules
- Never hardcode model names; import from `src/lib/ai-models.ts`.
- Schema changes: edit schema → generate migration → show me the SQL before applying.
- Don't touch the FSRS rating logic without explaining the change first.
- Small commits with clear messages. Ask before any destructive DB operation
  (DROP, DELETE without WHERE, TRUNCATE, resetting data).

## Security
- Secrets live in `.env*` files and Vercel env vars. NEVER read, print, log, or commit them.
- Never paste a connection string into code, comments, tests, or chat output.
- If you see a secret anywhere in the repo, stop and tell me.

## Roadmap
Done: 0.5 repo hygiene · 1 schema/seed · 2 FSRS engine · 3 PBQ types
Next: 4 PDF/image ingestion (Messer notes, study guide, ACI slide decks 1–8,
SY0-701 objectives PDF) · 5 card generation pipeline · 6 progress dashboard + Birkenbihl
ABC lists · 7 optional Notion import

## How I like to work
- Plan first for anything touching more than 2 files; wait for my OK.
- Give me copy-paste git commands, not explanations of git.
- Be direct. If an idea of mine is bad, say so.
