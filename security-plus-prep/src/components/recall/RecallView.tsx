'use client';

import { useRef, useState } from 'react';
import {
  submitTypedRecall,
  transcribeImage,
  submitHandwrittenRecall,
  submitDrawingOnly,
  type RecallResult,
} from '../../../app/recall/actions';
import { generateDraft, saveCard, type SaveCardInput } from '../../../app/create/actions';
import type { GeneratedCardDraft } from '@/lib/card-generation';
import { DrawingCanvas, type DrawingCanvasHandle } from './DrawingCanvas';
import { CardEditorFields, type EditableCard } from '../review/CardEditorFields';

type Mode = 'typed' | 'handwritten' | 'drawing';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #ccc',
  borderRadius: 6,
  font: 'inherit',
};

function draftFromGenerated(g: GeneratedCardDraft): EditableCard {
  const correct = Array.isArray(g.correct) ? g.correct : [g.correct];
  return {
    topic: g.topic,
    question: g.question,
    options: [...g.options],
    correct,
    explanation: g.explanation,
    distractorExplanations: [...g.distractorExplanations],
  };
}

// One missed key point, with an inline "turn this into a card" flow reusing
// the exact same generateDraft/saveCard/CardEditorFields the /create page
// uses — not a fork of that logic.
function MissedPointCard({ point, objective, domain }: { point: string; objective: string | null; domain: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<EditableCard | null>(null);
  const [genType, setGenType] = useState<'multiple_choice' | 'multiple_select'>('multiple_choice');
  const [saveIssues, setSaveIssues] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleGenerate() {
    if (!domain) return;
    setGenerating(true);
    setSaveIssues(null);
    try {
      const result = await generateDraft({
        note: point,
        domain,
        objective: objective ?? undefined,
        type: genType,
        requiredCount: genType === 'multiple_select' ? 2 : undefined,
      });
      setDraft(draftFromGenerated(result));
      setExpanded(true);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    const input: SaveCardInput = {
      domain: domain ?? '',
      objective: objective ?? null,
      topic: draft.topic,
      type: genType,
      question: draft.question,
      options: draft.options,
      correct: draft.correct,
      requiredCount: genType === 'multiple_select' ? draft.correct.length : undefined,
      explanation: draft.explanation,
      distractorExplanations: draft.distractorExplanations,
      authoredDifficulty: 'application',
    };
    const result = await saveCard(input);
    if (!result.ok) {
      setSaveIssues(result.issues);
      return;
    }
    setSaved(true);
    setDraft(null);
  }

  if (!domain) return <li style={{ marginBottom: 6 }}>{point}</li>;

  return (
    <li style={{ marginBottom: 10, listStyle: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <span>• {point}</span>
        {saved ? (
          <span style={{ color: '#2e7d32', fontSize: 13, whiteSpace: 'nowrap' }}>Saved ✓</span>
        ) : !draft ? (
          <button type="button" onClick={handleGenerate} disabled={generating} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {generating ? 'Drafting...' : 'Turn into a card'}
          </button>
        ) : null}
      </div>

      {draft && (
        <div style={{ marginTop: 8, marginLeft: 16, padding: 10, border: '1px solid #ddd', borderRadius: 6 }}>
          <button type="button" onClick={() => setExpanded((e) => !e)} style={{ fontSize: 12, marginBottom: 8 }}>
            {expanded ? 'Collapse' : 'Expand'} draft
          </button>
          {expanded && (
            <>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Type</label>
                <select
                  value={genType}
                  onChange={(e) => setGenType(e.target.value as typeof genType)}
                  style={{ ...inputStyle, fontSize: 13 }}
                >
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="multiple_select">Multiple select</option>
                </select>
              </div>
              <CardEditorFields value={draft} onChange={setDraft} type={genType} />
              {saveIssues && (
                <div style={{ background: '#fdf4f4', border: '1px solid #f0c4c4', borderRadius: 6, padding: 8, marginTop: 8, fontSize: 12 }}>
                  {saveIssues.map((i, idx) => (
                    <p key={idx} style={{ margin: 0, color: '#c0392b' }}>
                      {i}
                    </p>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <button type="button" onClick={handleSave}>
                  Save to deck
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function GapReportView({ result, objective, domain }: { result: RecallResult; objective: string | null; domain: string | null }) {
  const pct = Math.round(result.score * 100);
  return (
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #ddd' }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>
        Recalled {result.gapReport.correct.length} of {result.gapReport.correct.length + result.gapReport.missed.length} key points ({pct}%)
      </p>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Feedback, not a grade — this is what to review, not a score to feel good or bad about.</p>

      {result.gapReport.correct.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, color: '#2e7d32', marginBottom: 6 }}>What you got right</h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {result.gapReport.correct.map((c, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.gapReport.errors.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, color: '#c0392b', marginBottom: 6 }}>Factually wrong</h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {result.gapReport.errors.map((e, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.gapReport.missed.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, color: '#b8860b', marginBottom: 6 }}>Missed entirely</h3>
          <ul style={{ margin: 0, paddingLeft: 0 }}>
            {result.gapReport.missed.map((m, i) => (
              <MissedPointCard key={i} point={m} objective={objective} domain={domain} />
            ))}
          </ul>
        </div>
      )}

      {result.drawingComments && (
        <div style={{ marginTop: 16, padding: 12, background: '#f7f7f7', borderRadius: 6 }}>
          <p style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Diagram feedback (qualitative only, not scored)</p>
          <p style={{ fontSize: 13, margin: 0 }}>{result.drawingComments}</p>
        </div>
      )}
    </div>
  );
}

export function RecallView({ objective, topic, domain }: { objective: string | null; topic: string; domain: string | null }) {
  const [mode, setMode] = useState<Mode>('typed');
  const [text, setText] = useState('');
  const [attachDrawing, setAttachDrawing] = useState(false);
  const typedCanvasRef = useRef<DrawingCanvasHandle>(null);
  const drawingOnlyCanvasRef = useRef<DrawingCanvasHandle>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RecallResult | null>(null);
  const [drawingOnlyComments, setDrawingOnlyComments] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handwritten-path state — split into "capturing" (drawing/uploading,
  // pre-OCR) and "confirming" (transcription shown, editable, gated).
  const [hwImageFile, setHwImageFile] = useState<File | null>(null);
  const [hwTranscribing, setHwTranscribing] = useState(false);
  const [hwImageUrl, setHwImageUrl] = useState<string | null>(null);
  const [hwRawTranscription, setHwRawTranscription] = useState<string | null>(null);
  const [hwEditedTranscription, setHwEditedTranscription] = useState('');
  const [hwDiagramDescription, setHwDiagramDescription] = useState<string | null>(null);
  const hwCanvasRef = useRef<DrawingCanvasHandle>(null);

  function resetAll() {
    setResult(null);
    setDrawingOnlyComments(null);
    setError(null);
    setText('');
    setAttachDrawing(false);
    setHwImageFile(null);
    setHwImageUrl(null);
    setHwRawTranscription(null);
    setHwEditedTranscription('');
    setHwDiagramDescription(null);
  }

  async function handleSubmitTyped() {
    if (text.trim() === '') return;
    setSubmitting(true);
    setError(null);
    try {
      let drawingFile: File | undefined;
      if (attachDrawing && typedCanvasRef.current && !typedCanvasRef.current.isEmpty()) {
        drawingFile = await typedCanvasRef.current.exportPng();
      }
      const res = await submitTypedRecall({ objective, topic, text, drawingFile });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCaptureForOcr(file: File) {
    setHwImageFile(file);
    setHwTranscribing(true);
    setError(null);
    try {
      const { imageUrl, transcription, diagramDescription } = await transcribeImage(file);
      setHwImageUrl(imageUrl);
      setHwRawTranscription(transcription);
      setHwEditedTranscription(transcription);
      setHwDiagramDescription(diagramDescription);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setHwTranscribing(false);
    }
  }

  async function handleDrawForOcr() {
    if (!hwCanvasRef.current || hwCanvasRef.current.isEmpty()) return;
    const file = await hwCanvasRef.current.exportPng();
    await handleCaptureForOcr(file);
  }

  // The confirmation gate: grading only ever runs from here, after the
  // user has seen and can edit the transcription. There is no path that
  // calls submitHandwrittenRecall without this function having run first.
  async function handleConfirmAndGrade() {
    if (!hwImageUrl || hwRawTranscription === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitHandwrittenRecall({
        objective,
        topic,
        imageUrl: hwImageUrl,
        rawTranscription: hwRawTranscription,
        confirmedTranscription: hwEditedTranscription,
        diagramDescription: hwDiagramDescription,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitDrawingOnly() {
    if (!drawingOnlyCanvasRef.current || drawingOnlyCanvasRef.current.isEmpty()) return;
    setSubmitting(true);
    setError(null);
    try {
      const file = await drawingOnlyCanvasRef.current.exportPng();
      const res = await submitDrawingOnly({ objective, topic, drawingFile: file });
      setDrawingOnlyComments(res.drawingComments);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const locked = submitting || result !== null || drawingOnlyComments !== null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['typed', 'handwritten', 'drawing'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              resetAll();
            }}
            disabled={locked && mode !== m}
            style={{ fontWeight: mode === m ? 700 : 400, padding: '6px 12px' }}
          >
            {m === 'typed' ? 'Type' : m === 'handwritten' ? 'Handwrite / upload' : 'Draw only'}
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#c0392b', marginBottom: 12 }}>{error}</p>}

      {mode === 'typed' && !result && (
        <div>
          <p style={{ color: '#666', marginBottom: 8 }}>Write everything you know about &quot;{topic}&quot; from memory.</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            disabled={locked}
            style={{ ...inputStyle, resize: 'vertical' }}
            autoFocus
          />
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 13 }}>
              <input type="checkbox" checked={attachDrawing} onChange={(e) => setAttachDrawing(e.target.checked)} disabled={locked} />{' '}
              Add a supporting diagram (optional — commented on, not scored)
            </label>
          </div>
          {attachDrawing && (
            <div style={{ marginTop: 10 }}>
              <DrawingCanvas ref={typedCanvasRef} locked={locked} />
            </div>
          )}
          <button type="button" onClick={handleSubmitTyped} disabled={locked || text.trim() === ''} style={{ marginTop: 12 }}>
            {submitting ? 'Grading...' : 'Submit for grading'}
          </button>
        </div>
      )}

      {mode === 'handwritten' && !result && (
        <div>
          {!hwImageUrl ? (
            <>
              <p style={{ color: '#666', marginBottom: 8 }}>
                Handwrite your recall (prose and diagrams together) on the canvas, or upload a photo of paper notes.
              </p>
              <DrawingCanvas ref={hwCanvasRef} locked={hwTranscribing} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <button type="button" onClick={handleDrawForOcr} disabled={hwTranscribing}>
                  {hwTranscribing ? 'Reading handwriting...' : 'Use this drawing'}
                </button>
                <span style={{ color: '#999', fontSize: 13 }}>or</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={hwTranscribing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCaptureForOcr(file);
                  }}
                />
              </div>
            </>
          ) : (
            <div>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Review the transcription before grading</p>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                Fix any OCR mistakes (especially technical terms) — grading only runs on what&apos;s below, and only once you confirm.
              </p>
              <textarea
                value={hwEditedTranscription}
                onChange={(e) => setHwEditedTranscription(e.target.value)}
                rows={10}
                disabled={locked}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              {hwDiagramDescription && (
                <div style={{ marginTop: 10, padding: 10, background: '#f7f7f7', borderRadius: 6, fontSize: 13 }}>
                  <strong>Diagram detected:</strong> {hwDiagramDescription}
                  <br />
                  <span style={{ color: '#666' }}>(commented on, not scored — shown as-is, nothing to confirm here)</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" onClick={handleConfirmAndGrade} disabled={locked || hwEditedTranscription.trim() === ''}>
                  {submitting ? 'Grading...' : 'Confirm transcription and grade'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHwImageFile(null);
                    setHwImageUrl(null);
                    setHwRawTranscription(null);
                    setHwEditedTranscription('');
                    setHwDiagramDescription(null);
                  }}
                  disabled={locked}
                >
                  Start over
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'drawing' && !drawingOnlyComments && (
        <div>
          <p style={{ color: '#666', marginBottom: 8 }}>Sketch a diagram for &quot;{topic}&quot; — no text recall, comments only, never scored.</p>
          <DrawingCanvas ref={drawingOnlyCanvasRef} locked={locked} />
          <button type="button" onClick={handleSubmitDrawingOnly} disabled={locked} style={{ marginTop: 12 }}>
            {submitting ? 'Getting feedback...' : 'Submit drawing'}
          </button>
        </div>
      )}

      {result && <GapReportView result={result} objective={objective} domain={domain} />}

      {drawingOnlyComments && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #ddd' }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Feedback on your drawing</p>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>Qualitative only — drawings are never scored.</p>
          <p>{drawingOnlyComments}</p>
        </div>
      )}

      {(result || drawingOnlyComments) && (
        <button type="button" onClick={resetAll} style={{ marginTop: 20 }}>
          New attempt
        </button>
      )}
    </div>
  );
}
