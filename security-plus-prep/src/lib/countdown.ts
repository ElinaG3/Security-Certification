const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WeekSegment {
  label: string;
  current: boolean;
}

export interface CountdownInfo {
  daysUntilExam: number; // can be negative if the exam date has passed
  weeks: WeekSegment[]; // always 8 segments, last one "Exam week"
}

// Fixed 8-segment countdown timeline (Week 1 .. Week 7, Exam week). The
// highlighted segment is whichever week `today` falls into, counting
// BACKWARD from the exam: 0-6 days out -> Exam week (last segment); 7-13
// days out -> Week 7; ...; 49+ days out clamps to Week 1 (an 8-week
// runway is as far out as the bar visualizes, even if the real exam is
// further away).
export function getCountdownInfo(examDate: Date, now: Date = new Date()): CountdownInfo {
  const daysUntilExam = Math.ceil((examDate.getTime() - now.getTime()) / DAY_MS);
  const weeksUntilExam = Math.ceil(daysUntilExam / 7);
  const segmentFromEnd = Math.min(8, Math.max(1, weeksUntilExam)); // 1 = exam week, 8 = Week 1
  const currentIndex = 8 - segmentFromEnd; // 0-indexed from the left

  const weeks: WeekSegment[] = Array.from({ length: 8 }, (_, i) => ({
    label: i === 7 ? 'Exam week' : `Week ${i + 1}`,
    current: i === currentIndex,
  }));

  return { daysUntilExam, weeks };
}

export function formatExamDate(examDate: Date): string {
  return examDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}
