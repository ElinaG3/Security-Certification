'use server';

import { getActiveCertificationId } from '@/lib/active-certification';
import { getProfileSettings } from '@/lib/profile-settings';
import { toPublicContent, type PublicCard } from '@/lib/question-public';
import type { FillInContent } from '@/db/question-types';
import type { GapReport } from '@/lib/recall-grading';
import {
  getOrStartTodayRoutine,
  setTopic,
  advanceStep,
  getC2Queue,
  computeErrorList,
  computeForgotten,
  generateMistakeCards,
  getCardsByIds,
  appendC2Result,
  markC2ResultCorrected,
  resolveDomainAndObjectiveForTopic,
  requireOwnedRow,
  type RoutineRow,
  type C1Data,
  type C2Data,
  type C3Data,
} from '@/lib/routine';
import { submitTypedRecall } from '../recall/actions';
import { submitAnswer, overrideFillInAnswer, flagCard, type OverrideFillInResult } from '../study/actions';

export async function startTodayRoutine(): Promise<RoutineRow> {
  return getOrStartTodayRoutine();
}

export async function pickTopic(sessionId: string, topic: string): Promise<RoutineRow> {
  return setTopic(sessionId, topic.trim());
}

export interface SubmitC1Result {
  row: RoutineRow;
  gapReport: GapReport;
  score: number;
}

// Grades the ABC grid + free-recall box as one combined text (reusing
// gradeRecallText/recallAttempts exactly as the /recall page does — no
// separate grading path for the grid vs. the box), then immediately fixes
// the C2 queue so a reload during C2 resumes the SAME set of cards rather
// than recomputing due dates.
export async function submitC1({
  sessionId,
  abcAnswers,
  freeRecallText,
}: {
  sessionId: string;
  abcAnswers: Record<string, string>;
  freeRecallText: string;
}): Promise<SubmitC1Result> {
  const session = await requireOwnedRow(sessionId);
  const topic = session.topic;
  if (!topic) throw new Error('Routine session has no topic set — call pickTopic first');
  const certificationId = await getActiveCertificationId();
  const { objective } = await resolveDomainAndObjectiveForTopic(topic, certificationId);

  const abcLines = Object.entries(abcAnswers)
    .filter(([, v]) => v.trim() !== '')
    .map(([letter, v]) => `${letter}: ${v.trim()}`)
    .join('\n');
  const combinedText = [abcLines, freeRecallText.trim()].filter(Boolean).join('\n\n');

  const recallResult = await submitTypedRecall({ objective, topic, text: combinedText });

  const c1: C1Data = {
    abcAnswers,
    freeRecallText,
    recallAttemptId: recallResult.attemptId,
    gapReport: recallResult.gapReport,
    score: recallResult.score,
  };

  const settings = await getProfileSettings();
  const queueCards = await getC2Queue(settings.dailyQuestionCount);
  const c2: C2Data = { cardIds: queueCards.map((c) => c.id), results: [] };

  const row = await advanceStep(sessionId, 'c2', { c1, c2 });
  return { row, gapReport: recallResult.gapReport, score: recallResult.score };
}

// Sanitized card list for whatever's left in the session's fixed C2 queue
// — never the full card row (that would leak acceptedAnswers/explanation
// to the client before an answer is submitted, same rule app/study/page.tsx
// follows via toPublicContent).
export async function getC2RemainingCards(sessionId: string): Promise<PublicCard[]> {
  const session = await requireOwnedRow(sessionId);
  const c2 = session.c2 as C2Data;
  const answeredCardIds = new Set(c2.results.map((r) => r.cardId));
  const remainingIds = c2.cardIds.filter((id) => !answeredCardIds.has(id));
  const rows = await getCardsByIds(remainingIds);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return remainingIds
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .map((c) => ({
      id: c.id,
      domain: c.domain,
      topic: c.topic,
      type: 'fill_in' as const,
      content: toPublicContent('fill_in', c.content as FillInContent),
    }));
}

export interface SubmitC2Result {
  correct: boolean;
  explanation: string;
  correctAnswer?: string;
  reviewLogId?: string;
  allDone: boolean;
}

export async function submitC2Answer({
  sessionId,
  cardId,
  answer,
  responseMs,
}: {
  sessionId: string;
  cardId: string;
  answer: string;
  responseMs: number;
}): Promise<SubmitC2Result> {
  const result = await submitAnswer({ cardId, selected: answer, responseMs, elaborationSkipped: false });
  if (result.kind !== 'fill_in') throw new Error(`Expected a fill_in card, got ${result.kind}`);

  const { allDone } = await appendC2Result(sessionId, {
    cardId,
    userAnswer: answer,
    correct: result.correct,
    reviewLogId: result.reviewLogId ?? null,
  });

  return { correct: result.correct, explanation: result.explanation, correctAnswer: result.correctAnswer, reviewLogId: result.reviewLogId, allDone };
}

export async function overrideC2Answer({
  sessionId,
  reviewLogId,
  userAnswer,
}: {
  sessionId: string;
  reviewLogId: string;
  userAnswer: string;
}): Promise<OverrideFillInResult> {
  const result = await overrideFillInAnswer({ reviewLogId, userAnswer });
  if (result.ok) await markC2ResultCorrected(sessionId, reviewLogId);
  return result;
}

export interface SubmitC3Result {
  row: RoutineRow;
  actualErrors: C3Data['actualErrors'];
  forgotten: string[];
}

export async function submitC3({ sessionId, userErrorText }: { sessionId: string; userErrorText: string }): Promise<SubmitC3Result> {
  const session = await requireOwnedRow(sessionId);
  const c1 = session.c1 as C1Data | null;
  const c2 = session.c2 as C2Data;
  const c2Cards = await getCardsByIds(c2.cardIds);
  const actualErrors = computeErrorList(c1, c2.results, c2Cards);
  const forgotten = computeForgotten(userErrorText, actualErrors);

  const c3: C3Data = { userErrorText, actualErrors, forgotten };
  const row = await advanceStep(sessionId, 'c4', { c3 });
  return { row, actualErrors, forgotten };
}

export interface GenerateC4Result {
  row: RoutineRow;
  createdCards: { id: string; question: string }[];
  skippedErrorCount: number;
}

export async function generateC4({ sessionId }: { sessionId: string }): Promise<GenerateC4Result> {
  const session = await requireOwnedRow(sessionId);
  const topic = session.topic;
  if (!topic) throw new Error('Routine session has no topic set');
  const c3 = session.c3 as C3Data;
  const c4 = await generateMistakeCards(topic, c3.actualErrors);
  const created = await getCardsByIds(c4.createdCardIds);
  const row = await advanceStep(sessionId, 'end', { c4 });
  return {
    row,
    createdCards: created.map((c) => ({ id: c.id, question: (c.content as FillInContent).question })),
    skippedErrorCount: c4.skippedErrorCount,
  };
}

export async function flagNewCard(cardId: string, note?: string): Promise<void> {
  await flagCard({ cardId, note });
}
