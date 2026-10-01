# Project Status Report

*Generated 2026-08-05 by static analysis of the repo (code, schema, migrations, scripts, git history). No live database access was available locally, so DB-dependent figures (exact card totals, pending review counts) are noted as unverified where relevant.*

---

## 1. Project Overview

**security-plus-exam-prep** (`package.json` v2.0.0) — "CompTIA Security+ retrieval-practice study app (FSRS spaced repetition)."

**⚠️ The README is stale and describes a different, earlier version of this project.** It documents a Vite + React + Tailwind SPA with client-side-only state, roadmap items like "spaced-repetition review of missed questions," and a `npm run dev` flow for that stack. The actual code on `main` is a **complete rewrite**: Next.js 16 (App Router) + React 19 + Drizzle ORM + Neon Postgres + `ts-fsrs`, with an AI-assisted content pipeline (Anthropic SDK) and Vercel-native deployment (`vercel.ts`, `@vercel/analytics`, Neon via Vercel Marketplace). The old Vite app still exists in `legacy/` and `dist/` but is superseded.

There is no ROADMAP.md or TODO.md. `docs/` contains a single file, `phase-6-abc-lists.md`, a spec for an unbuilt "free recall" study mode — there are no equivalent written specs for phases 1–5; that context lives only in commit messages.

**Notable repo quirk:** GitHub's default branch (`origin/HEAD`) points at `test`, not `main` — and `test` is the *old* pre-rewrite codebase (missing the entire Next.js/Drizzle layer that `main` has). Anyone cloning without explicitly checking out `main` gets the outdated app.

## 2. What's Done

**Data layer** (`src/db/schema.ts`, 3 applied Drizzle migrations)
- `users`, `cards` (JSONB `content` as a discriminated union by `type`, plus full FSRS state columns), append-only `review_log`, and `explanation_suggestions` (staged AI output awaiting human approval before merging into live cards).

**Spaced repetition engine** (`src/lib/fsrs.ts`)
- Full `ts-fsrs` integration. Grading isn't a self-reported tap — it's derived from correctness + response time vs. a rolling per-question-type median (`Again`/`Hard`/`Good`/`Easy`), with a minimum-sample guard before trusting the speed signal.

**Study flow** (`app/study/`, `src/components/StudySession.tsx`, `src/lib/queue.ts`)
- Domain-interleaved due-card queue (round-robin across domains, or single-domain focus mode via `?domain=`), 15-card default session.
- Server/client boundary is deliberately enforced: `app/study/page.tsx` strips answers before the payload ever reaches the browser; `submitAnswer` (`app/study/actions.ts`) is the only place grading, FSRS updates, and answer-reveal happen, and only after submission.

**Auth** (`src/lib/auth.ts`)
- Intentional single-user stub — every query already goes through a real `userId` FK, so this is documented as a scoped swap, not a future rewrite.

**Content pipeline** (`scripts/`, ~1,250 lines total)
- `seed.ts` (135 legacy questions), `generate-cards.ts` (Anthropic-driven generation targeting official SY0-701 domain weights, planned +115 cards → 250 total), `generate-explanations.ts` / `review-explanations.ts` (AI-drafted distractor explanations staged for human review), `check-card-consistency.ts` + `repair-rejected-cards.ts` (structural QA and repair), and `audit-cards.ts` — a purpose-built, read-only ground-truth report (domain balance vs. official weights, question-type mix, metadata coverage, explanation coverage, usage stats, and an explicit check for a results screen).

**Deployment**
- Vercel-linked (`.vercel/`), Neon Postgres provisioned via Vercel Marketplace, `@vercel/analytics` wired in, production framework-detection bug already fixed (`4cb7f1e`).

**Recent git activity** (last 5 commits, all Aug 3–4) is entirely content-quality tooling — domain rebalancing, structural consistency checks, a targeted repair script — not new user-facing features. The last *feature* commit was FSRS/study-session wiring (`e820403`, "Phase 2").

## 3. What's In Progress / Half-Finished

- **Homepage is explicitly a placeholder**: `app/page.tsx` is titled "Phase 1 smoke test" in its own JSX — it just lists seeded card counts per domain and a link to `/study`. No real landing page or dashboard exists yet.
- **No end-of-session results screen.** `StudySession.tsx` ends a session with a bare "Session complete." after the last card's own feedback — no aggregate summary, no per-question review. This gap is significant enough that `scripts/audit-cards.ts` has a dedicated check (#7) that greps for one and reports it missing.
- **Content generation completion is unverified.** `generate-cards.ts` targets 250 total cards (135 legacy + 115 generated) at official SY0-701 weights, but the actual current count, and the `explanation_suggestions` pending/approved backlog, couldn't be confirmed here — `DATABASE_URL` isn't populated in the local `.env`/`.env.local` (only `DIRECT_URL`, `ANTHROPIC_API_KEY`, `VERCEL_OIDC_TOKEN` are set). Run `npx dotenv-cli -e .env.local -e .env -- tsx scripts/audit-cards.ts` with real DB credentials to get live numbers.
- **Uncommitted work in progress:** `next-env.d.ts` modified (benign, auto-generated) and an untracked `samples-new.txt` (239 lines) that reads like a manual-QA scratch file of sampled cards from the recent domain-rebalance generation batch — not part of the shipped app.
- **`docs/phase-6-abc-lists.md`** fully specs a free-recall "ABC list" study mode with zero corresponding code. This is expected, not stalled — the doc itself says "optional; do not let it block phases 1–3."
- **Dead code left over from the migration:** `legacy/` (old `.jsx` files) and `dist/` (old Vite build output) are still in the tree post-rewrite.

## 4. What's Missing (priority order)

1. **Session results/summary screen** — the app's own audit script flags this as absent. Without it, "track your progress," the README's core value proposition, has no realization at the point where a user would actually see it (end of session).
2. **Verify content-pipeline completion** — confirm actual card count against the 250-card target and clear the `explanation_suggestions` review backlog. Needs DB access to even measure.
3. **Real authentication / multi-user support** — currently hard-stubbed to one seeded user. Schema is ready for it; this blocks any use beyond the single owner.
4. **A real landing page / progress dashboard** — replace the "Phase 1 smoke test" homepage with domain-mastery visualization, streaks, or whatever "progress tracking" is meant to mean, per the README's stated design goals.
5. **README rewrite** — it currently documents a different app (wrong stack, wrong run instructions, stale roadmap) and should reflect Next.js/Postgres/FSRS, plus fix the GitHub default-branch mismatch.
6. **Repo hygiene** — remove `legacy/`/`dist/` (superseded Vite app), resolve `samples-new.txt`, and consider whether `test` should still be the GitHub default branch.
7. **ABC list free-recall mode** (`docs/phase-6-abc-lists.md`) — fully speced, ~half a day of estimated effort per the doc, explicitly low priority.
8. **Original README roadmap items with no code yet**: timed/scored exam simulation mode, EN/DE multilingual support.

## 5. Current Phase

This project is past early scaffolding and into **core-features-built, content-and-polish phase**: the hard architectural work — FSRS scheduling, the answer-integrity server/client boundary, and an AI-assisted content pipeline with human-review gates — is done and deployed, but the app-facing experience is still a smoke test around it (no results screen, no dashboard, single user only). The single most important next step is closing the **session results screen** gap, since it's the one missing piece that sits directly in the main user loop (study → see how you did), followed closely by verifying the content pipeline actually reached its target card count.
