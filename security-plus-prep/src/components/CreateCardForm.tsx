'use client';

import { useState } from 'react';
import { generateDraft, saveCard, type SaveCardInput } from '../../app/create/actions';
import { SY0_701_DOMAINS } from '@/lib/domains';
import type { GeneratedCardDraft } from '@/lib/card-generation';

type DraftState = {
  topic: string;
  question: string;
  options: string[];
  correct: number[]; // indices currently marked correct
  explanation: string;
  distractorExplanations: string[];
  authoredDifficulty: 'application' | 'analysis';
};

function draftFromGenerated(g: GeneratedCardDraft): DraftState {
  const correct = Array.isArray(g.correct) ? g.correct : [g.correct];
  return {
    topic: g.topic,
    question: g.question,
    options: [...g.options],
    correct,
    explanation: g.explanation,
    distractorExplanations: [...g.distractorExplanations],
    authoredDifficulty: g.authoredDifficulty,
  };
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #ccc',
  borderRadius: 6,
  font: 'inherit',
};

const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 };

export function CreateCardForm() {
  const [note, setNote] = useState('');
  const [domain, setDomain] = useState<string>(SY0_701_DOMAINS[0]);
  const [objective, setObjective] = useState('');
  const [type, setType] = useState<'multiple_choice' | 'multiple_select'>('multiple_choice');
  const [requiredCount, setRequiredCount] = useState<2 | 3>(2);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveIssues, setSaveIssues] = useState<string[] | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    setSaveIssues(null);
    setSavedMessage(null);
    try {
      const result = await generateDraft({
        note,
        domain,
        objective: objective.trim() || undefined,
        type,
        requiredCount: type === 'multiple_select' ? requiredCount : undefined,
      });
      setDraft(draftFromGenerated(result));
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  function update(patch: Partial<DraftState>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function updateOption(idx: number, text: string) {
    if (!draft) return;
    const options = [...draft.options];
    options[idx] = text;
    update({ options });
  }

  function updateDistractor(idx: number, text: string) {
    if (!draft) return;
    const distractorExplanations = [...draft.distractorExplanations];
    distractorExplanations[idx] = text;
    update({ distractorExplanations });
  }

  function toggleCorrect(idx: number) {
    if (!draft) return;
    const correct =
      type === 'multiple_choice'
        ? [idx]
        : draft.correct.includes(idx)
          ? draft.correct.filter((i) => i !== idx)
          : [...draft.correct, idx];
    // A newly-correct option's distractor explanation must be empty; a
    // newly-wrong one keeps whatever text it had (usually blank, since it
    // was correct a moment ago) so the user can fill it in.
    const distractorExplanations = draft.distractorExplanations.map((d, i) => (correct.includes(i) ? '' : d));
    update({ correct, distractorExplanations });
  }

  function addOption() {
    if (!draft) return;
    update({ options: [...draft.options, ''], distractorExplanations: [...draft.distractorExplanations, ''] });
  }

  function removeOption(idx: number) {
    if (!draft) return;
    update({
      options: draft.options.filter((_, i) => i !== idx),
      distractorExplanations: draft.distractorExplanations.filter((_, i) => i !== idx),
      correct: draft.correct.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i)),
    });
  }

  function handleDiscard() {
    setDraft(null);
    setGenError(null);
    setSaveIssues(null);
    setSavedMessage(null);
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaveIssues(null);
    setSavedMessage(null);

    const input: SaveCardInput = {
      domain,
      objective: objective.trim() || null,
      topic: draft.topic,
      type,
      question: draft.question,
      options: draft.options,
      correct: draft.correct,
      requiredCount: type === 'multiple_select' ? draft.correct.length : undefined,
      explanation: draft.explanation,
      distractorExplanations: draft.distractorExplanations,
      authoredDifficulty: draft.authoredDifficulty,
    };
    const result = await saveCard(input);
    setSaving(false);

    if (!result.ok) {
      setSaveIssues(result.issues);
      return;
    }
    setSavedMessage('Saved to deck.');
    setDraft(null);
    setNote('');
  }

  return (
    <div>
      <fieldset disabled={!!draft} style={{ border: 'none', padding: 0, margin: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="Paste or type the concept — a sentence, a paragraph, a video-note excerpt..."
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label style={labelStyle}>Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} style={inputStyle}>
              {SY0_701_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <label style={labelStyle}>Objective (optional)</label>
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. 1.3"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: '0 1 180px' }}>
            <label style={labelStyle}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} style={inputStyle}>
              <option value="multiple_choice">Multiple choice</option>
              <option value="multiple_select">Multiple select</option>
            </select>
          </div>
          {type === 'multiple_select' && (
            <div style={{ flex: '0 1 140px' }}>
              <label style={labelStyle}>Correct count</label>
              <select
                value={requiredCount}
                onChange={(e) => setRequiredCount(Number(e.target.value) as 2 | 3)}
                style={inputStyle}
              >
                <option value={2}>Choose two</option>
                <option value={3}>Choose three</option>
              </select>
            </div>
          )}
        </div>

        <button onClick={handleGenerate} disabled={generating || note.trim() === ''}>
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </fieldset>

      {genError && <p style={{ color: '#c0392b', marginTop: 12 }}>{genError}</p>}

      {draft && (
        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #ddd' }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Draft — edit before saving</h2>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Topic</label>
            <input value={draft.topic} onChange={(e) => update({ topic: e.target.value })} style={inputStyle} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Question</label>
            <textarea
              value={draft.question}
              onChange={(e) => update({ question: e.target.value })}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <label style={labelStyle}>Options {type === 'multiple_choice' ? '(pick one correct)' : '(check all correct)'}</label>
          {draft.options.map((opt, idx) => {
            const isCorrect = draft.correct.includes(idx);
            return (
              <div
                key={idx}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 8,
                  background: isCorrect ? '#f4fbf6' : '#fff',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <input
                    type={type === 'multiple_choice' ? 'radio' : 'checkbox'}
                    name="correct"
                    checked={isCorrect}
                    onChange={() => toggleCorrect(idx)}
                    style={{ marginTop: 10 }}
                  />
                  <div style={{ flex: 1 }}>
                    <input
                      value={opt}
                      onChange={(e) => updateOption(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      style={inputStyle}
                    />
                    {!isCorrect && (
                      <textarea
                        value={draft.distractorExplanations[idx] ?? ''}
                        onChange={(e) => updateDistractor(idx, e.target.value)}
                        placeholder="Why this option is wrong in this scenario..."
                        rows={2}
                        style={{ ...inputStyle, marginTop: 6, fontSize: 13, resize: 'vertical' }}
                      />
                    )}
                  </div>
                  <button type="button" onClick={() => removeOption(idx)} disabled={draft.options.length <= 2}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          <button type="button" onClick={addOption} style={{ marginBottom: 16 }}>
            + Add option
          </button>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Explanation (why the correct answer is BEST)</label>
            <textarea
              value={draft.explanation}
              onChange={(e) => update({ explanation: e.target.value })}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {saveIssues && (
            <div style={{ background: '#fdf4f4', border: '1px solid #f0c4c4', borderRadius: 6, padding: 12, marginBottom: 16 }}>
              <p style={{ fontWeight: 600, color: '#c0392b', marginBottom: 6 }}>Can't save — fix these first:</p>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#c0392b' }}>
                {saveIssues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save to deck'}
            </button>
            <button type="button" onClick={handleDiscard} disabled={saving}>
              Discard
            </button>
            <button type="button" onClick={handleGenerate} disabled={saving || generating}>
              {generating ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>
        </div>
      )}

      {savedMessage && <p style={{ color: '#2e7d32', fontWeight: 600, marginTop: 16 }}>{savedMessage}</p>}
    </div>
  );
}
