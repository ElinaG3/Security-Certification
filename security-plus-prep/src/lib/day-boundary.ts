// The rest of the app uses plain UTC calendar dates (see dashboard.ts's
// getStudyStats — "not attempting per-user timezone handling, which
// nothing else in this app does either"). The Guided Learning Session's
// "one routine per day" rule specifically needs a Europe/Berlin day
// boundary (Elina studies from Berlin), so this is a narrow, new helper —
// not a general timezone system, and not reused by anything UTC-based.
export function todayKeyBerlin(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
}
