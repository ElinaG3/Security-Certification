// Decouples an option's storage position from where it's displayed, so
// display position never carries signal about which option is correct —
// see the position-leak bug this fixes (correct answer landing at index 0
// on ~62% of generated cards because nothing ever randomized order).
//
// `order[displayIndex] = storedIndex`. `order` is safe to hand to the
// client: it's generated independently of which index is correct (Fisher-
// Yates doesn't know `correct`), so it carries zero information about
// correctness on its own — see src/lib/question-public.ts's contract that
// pre-submit content must never leak the answer.
//
// Used two ways:
// - At render (question-public.ts): shuffle stored `options` for display.
// - At generation (card-generation.ts and the batch scripts): shuffle a
//   freshly-generated draft before it's ever written to the DB, so stored
//   order itself doesn't stay biased toward whatever position the model
//   habitually writes the correct answer in.

export function randomOrder(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Reorders `arr` (stored order) into display order.
export function applyOrder<T>(arr: T[], order: number[]): T[] {
  return order.map((storedIndex) => arr[storedIndex]);
}

// order[storedIndex] -> displayIndex, the inverse of `order`.
export function invertOrder(order: number[]): number[] {
  const inverse = new Array(order.length);
  order.forEach((storedIndex, displayIndex) => {
    inverse[storedIndex] = displayIndex;
  });
  return inverse;
}

// Validates that `order` is actually a permutation of [0, n) — defensive
// check before trusting client-supplied order data for index translation.
export function isValidOrder(order: unknown, n: number): order is number[] {
  if (!Array.isArray(order) || order.length !== n) return false;
  const seen = new Set<number>();
  for (const v of order) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= n || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

// Shuffles a freshly-generated card draft's options in place (before it's
// ever written to the DB), remapping `correct` and `distractorExplanations`
// to match. Used by card-generation.ts and the batch generation scripts —
// storage order shouldn't stay biased toward wherever the model habitually
// writes the correct answer, even though the display path (question-
// public.ts) re-shuffles independently on every render regardless.
export function shuffleChoiceContent<
  T extends { options: string[]; correct: number | number[]; distractorExplanations?: string[] },
>(content: T): T {
  const order = randomOrder(content.options.length); // order[newIndex] = oldIndex
  const newIndexOf = invertOrder(order); // oldIndex -> newIndex
  return {
    ...content,
    options: applyOrder(content.options, order),
    correct: Array.isArray(content.correct)
      ? content.correct.map((i) => newIndexOf[i])
      : newIndexOf[content.correct],
    distractorExplanations: content.distractorExplanations
      ? applyOrder(content.distractorExplanations, order)
      : undefined,
  };
}
