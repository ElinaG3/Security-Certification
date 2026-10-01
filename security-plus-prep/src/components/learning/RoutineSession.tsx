'use client';

import { useState } from 'react';
import type { RoutineRow, C1Data, C2Data } from '@/lib/routine';
import {
  pickTopic,
  submitC1,
  getC2RemainingCards,
  submitC2Answer,
  overrideC2Answer,
  submitC3,
  generateC4,
  flagNewCard,
} from '../../../app/learning/actions';
import { StageRecall } from './StageRecall';
import { StageTypedCards } from './StageTypedCards';
import { StageErrorLog } from './StageErrorLog';
import { StageNewCards } from './StageNewCards';

type UiStep = 'start' | 'c1' | 'c2' | 'c3' | 'c4' | 'done';

interface FinalSummary {
  topic: string | null;
  c1: C1Data | null;
  c2: C2Data | null;
  createdCardCount: number;
}

function summaryFromRow(row: RoutineRow): FinalSummary {
  return {
    topic: row.topic,
    c1: row.c1 as C1Data | null,
    c2: row.c2 as C2Data | null,
    createdCardCount: ((row.c4 as { createdCardIds: string[] } | null)?.createdCardIds.length) ?? 0,
  };
}

// Resume mapping: a routine's server-side `step` says how far it got, but
// the START screen's own local "Start" click (see below) isn't itself
// persisted — so a fresh mount goes straight to the stored step, skipping
// the start screen, for anything past 'start'.
function initialUiStep(row: RoutineRow): UiStep {
  if (row.status === 'completed') return 'done';
  if (row.step === 'c2' || row.step === 'c3' || row.step === 'c4') return row.step as UiStep;
  return 'start';
}

export function RoutineSession({
  initialSession,
  topicChoices,
}: {
  initialSession: RoutineRow;
  topicChoices: { domain: string; topic: string }[];
}) {
  const sessionId = initialSession.id;
  const [topic, setTopicState] = useState(initialSession.topic);
  const [uiStep, setUiStep] = useState<UiStep>(initialUiStep(initialSession));
  const [topicPick, setTopicPick] = useState('');
  const [c2Total, setC2Total] = useState((initialSession.c2 as C2Data | null)?.cardIds.length ?? 0);
  const [summary, setSummary] = useState<FinalSummary | null>(initialSession.status === 'completed' ? summaryFromRow(initialSession) : null);
  const [practiceMore, setPracticeMore] = useState(false);

  if (uiStep === 'done' && summary) {
    const correctCount = summary.c2?.results.filter((r) => r.correct).length ?? 0;
    const totalCount = summary.c2?.results.length ?? 0;
    return (
      <div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Done today ✓</h1>
        <p style={{ color: '#666', marginBottom: 4 }}>Topic: {summary.topic}</p>
        {summary.c1 && <p style={{ color: '#666', marginBottom: 4 }}>Recall: {Math.round(summary.c1.score * 100)}% of key points covered</p>}
        <p style={{ color: '#666', marginBottom: 4 }}>
          Cards done: {totalCount} — {totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0}% correct
        </p>
        <p style={{ color: '#666', marginBottom: 16 }}>New cards created: {summary.createdCardCount}</p>

        {practiceMore ? (
          <p style={{ color: '#666' }}>Extended session coming next.</p>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/learn">
              <button type="button">Done for today</button>
            </a>
            <button type="button" onClick={() => setPracticeMore(true)}>
              Practice more
            </button>
          </div>
        )}
      </div>
    );
  }

  if (uiStep === 'start') {
    return (
      <div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Today&apos;s routine · about 20 minutes</h1>
        {topic ? (
          <>
            <p style={{ color: '#666', marginBottom: 16 }}>Topic: {topic}</p>
            <button type="button" onClick={() => setUiStep('c1')}>
              Start
            </button>
          </>
        ) : (
          <>
            <p style={{ color: '#666', marginBottom: 8 }}>No recent topic found — pick one to start with.</p>
            <select value={topicPick} onChange={(e) => setTopicPick(e.target.value)} style={{ padding: 6, marginBottom: 16, display: 'block' }}>
              <option value="">Choose a topic...</option>
              {topicChoices.map((t) => (
                <option key={t.topic} value={t.topic}>
                  {t.domain} — {t.topic}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!topicPick}
              onClick={async () => {
                await pickTopic(sessionId, topicPick);
                setTopicState(topicPick);
                setUiStep('c1');
              }}
            >
              Start
            </button>
          </>
        )}
      </div>
    );
  }

  if (uiStep === 'c1') {
    return (
      <StageRecall
        topic={topic!}
        onSubmit={async (abcAnswers, freeRecallText) => {
          const res = await submitC1({ sessionId, abcAnswers, freeRecallText });
          setC2Total((res.row.c2 as C2Data).cardIds.length);
          return { gapReport: res.gapReport, score: res.score };
        }}
        onContinue={() => setUiStep('c2')}
      />
    );
  }

  if (uiStep === 'c2') {
    return (
      <StageTypedCards
        totalCount={c2Total}
        loadRemaining={() => getC2RemainingCards(sessionId)}
        onAnswer={(cardId, answer, responseMs) => submitC2Answer({ sessionId, cardId, answer, responseMs })}
        onOverride={async (reviewLogId, userAnswer) => (await overrideC2Answer({ sessionId, reviewLogId, userAnswer })).ok}
        onAllDone={() => setUiStep('c3')}
      />
    );
  }

  if (uiStep === 'c3') {
    return (
      <StageErrorLog
        onSubmit={async (userErrorText) => {
          const res = await submitC3({ sessionId, userErrorText });
          return { actualErrors: res.actualErrors, forgotten: res.forgotten };
        }}
        onContinue={() => setUiStep('c4')}
      />
    );
  }

  // c4
  return (
    <StageNewCards
      onGenerate={async () => {
        const res = await generateC4({ sessionId });
        setSummary(summaryFromRow(res.row));
        return { createdCards: res.createdCards, skippedErrorCount: res.skippedErrorCount };
      }}
      onFlag={(cardId) => flagNewCard(cardId)}
      onContinue={() => setUiStep('done')}
    />
  );
}
