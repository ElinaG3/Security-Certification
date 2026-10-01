'use client';

export type EditableCard = {
  topic: string;
  question: string;
  options: string[];
  correct: number[];
  explanation: string;
  distractorExplanations: string[];
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #ccc',
  borderRadius: 6,
  font: 'inherit',
};

const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 };

// Shared editable-fields block for a multiple_choice/multiple_select card —
// same shape as CreateCardForm's draft editor, factored out so /review can
// reuse it instead of re-implementing the option/correct/distractor UI.
export function CardEditorFields({
  value,
  onChange,
  type,
}: {
  value: EditableCard;
  onChange: (v: EditableCard) => void;
  type: 'multiple_choice' | 'multiple_select';
}) {
  function update(patch: Partial<EditableCard>) {
    onChange({ ...value, ...patch });
  }

  function updateOption(idx: number, text: string) {
    const options = [...value.options];
    options[idx] = text;
    update({ options });
  }

  function updateDistractor(idx: number, text: string) {
    const distractorExplanations = [...value.distractorExplanations];
    distractorExplanations[idx] = text;
    update({ distractorExplanations });
  }

  function toggleCorrect(idx: number) {
    const correct =
      type === 'multiple_choice'
        ? [idx]
        : value.correct.includes(idx)
          ? value.correct.filter((i) => i !== idx)
          : [...value.correct, idx];
    const distractorExplanations = value.distractorExplanations.map((d, i) => (correct.includes(i) ? '' : d));
    update({ correct, distractorExplanations });
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Topic</label>
        <input value={value.topic} onChange={(e) => update({ topic: e.target.value })} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Question</label>
        <textarea
          value={value.question}
          onChange={(e) => update({ question: e.target.value })}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <label style={labelStyle}>Options {type === 'multiple_choice' ? '(pick one correct)' : '(check all correct)'}</label>
      {value.options.map((opt, idx) => {
        const isCorrect = value.correct.includes(idx);
        return (
          <div
            key={idx}
            style={{
              border: '1px solid #ccc',
              borderRadius: 6,
              padding: 8,
              marginBottom: 6,
              background: isCorrect ? '#f4fbf6' : '#fff',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                type={type === 'multiple_choice' ? 'radio' : 'checkbox'}
                name={`correct-${type}`}
                checked={isCorrect}
                onChange={() => toggleCorrect(idx)}
                style={{ marginTop: 10 }}
              />
              <div style={{ flex: 1 }}>
                <input value={opt} onChange={(e) => updateOption(idx, e.target.value)} placeholder={`Option ${idx + 1}`} style={inputStyle} />
                {!isCorrect && (
                  <textarea
                    value={value.distractorExplanations[idx] ?? ''}
                    onChange={(e) => updateDistractor(idx, e.target.value)}
                    placeholder="Why this option is wrong in this scenario..."
                    rows={2}
                    style={{ ...inputStyle, marginTop: 6, fontSize: 13, resize: 'vertical' }}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 12, marginBottom: 4 }}>
        <label style={labelStyle}>Explanation (why the correct answer is BEST)</label>
        <textarea
          value={value.explanation}
          onChange={(e) => update({ explanation: e.target.value })}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
    </div>
  );
}
