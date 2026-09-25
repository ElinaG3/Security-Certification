# Phase 6 addition — ABC Lists (free recall)

Build alongside the progress dashboard.

## What it is
Birkenbihl-style ABC list: pick a domain, get A–Z down the page, type
everything you can recall for each letter. Free recall with letter cues —
retrieval practice, no prompts, no multiple choice.

## Flow
1. Pick a domain (or "all domains").
2. Timed entry screen, A–Z rows, tab/enter moves down. Default 5 min,
   skippable letters, no autocomplete, no spellcheck hints, no card content
   visible anywhere on screen.
3. On submit: fuzzy-match entries against concept + card terms for that
   domain (normalize case/punctuation; accept known synonyms and acronym
   expansions, e.g. "MFA" = "multi-factor authentication").
4. Gap report: matched terms per letter, then terms in the domain the user
   did NOT list, grouped by letter, each linking to its card.
5. Offer: "Add the missed terms to today's review queue" — inserts those
   cards as due now. This is the whole point; the list is a diagnostic that
   feeds the scheduler.

## Rules
- Never show the term list before or during entry.
- Do not score with a grade or percentage. Show counts: listed X of Y known
  terms in this domain. No streaks, no praise.
- Store each session (domain, entries, matched/missed term IDs, timestamp)
  so repeat lists over time show real coverage growth.

## Not in scope
No Claude API call needed for matching — string normalization plus a
synonym table is enough. Only fall back to the API if fuzzy matching proves
too weak in practice.

## Effort
~half a day. Optional; do not let it block phases 1–3.
