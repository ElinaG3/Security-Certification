'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCertification, type CreateCertificationDomain, type CreateCertificationObjective } from '../../app/certifications/actions';
import { setActiveCertification } from '../../app/actions';

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #ccc',
  borderRadius: 6,
  font: 'inherit',
};

const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 };

export function CreateCertificationForm() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [examCode, setExamCode] = useState('');
  const [sessionSize, setSessionSize] = useState(15);
  const [minMultiSelect, setMinMultiSelect] = useState(4);

  const [domains, setDomains] = useState<CreateCertificationDomain[]>([{ name: '', targetWeight: 0 }]);
  const [objectives, setObjectives] = useState<CreateCertificationObjective[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [issues, setIssues] = useState<string[] | null>(null);

  const weightSum = domains.reduce((sum, d) => sum + (Number.isFinite(d.targetWeight) ? d.targetWeight : 0), 0);

  function updateDomain(i: number, patch: Partial<CreateCertificationDomain>) {
    setDomains((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function removeDomain(i: number) {
    const removedName = domains[i].name;
    setDomains((prev) => prev.filter((_, idx) => idx !== i));
    // Objectives pointing at the removed domain would otherwise silently
    // reference a domain that no longer exists.
    setObjectives((prev) => prev.filter((o) => o.domain !== removedName));
  }

  function updateObjective(i: number, patch: Partial<CreateCertificationObjective>) {
    setObjectives((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  function removeObjective(i: number) {
    setObjectives((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setIssues(null);
    const result = await createCertification({
      name,
      examCode,
      domains,
      objectives,
      sessionSize,
      minMultiSelect,
    });
    if (!result.ok) {
      setIssues(result.issues);
      setSubmitting(false);
      return;
    }
    // Switch to the new cert immediately — the natural next step is filling
    // it with content, which every existing pipeline scopes to whichever
    // certification is active.
    await setActiveCertification(result.id);
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <label style={labelStyle}>Certification name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CompTIA Network+" style={{ ...inputStyle, width: '100%' }} />
        </div>
        <div style={{ flex: '0 1 160px' }}>
          <label style={labelStyle}>Exam code</label>
          <input value={examCode} onChange={(e) => setExamCode(e.target.value)} placeholder="e.g. N10-009" style={{ ...inputStyle, width: '100%' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 1 160px' }}>
          <label style={labelStyle}>Session size</label>
          <input type="number" min={1} value={sessionSize} onChange={(e) => setSessionSize(Number(e.target.value))} style={{ ...inputStyle, width: '100%' }} />
        </div>
        <div style={{ flex: '0 1 160px' }}>
          <label style={labelStyle}>Min multi-select per session</label>
          <input type="number" min={0} value={minMultiSelect} onChange={(e) => setMinMultiSelect(Number(e.target.value))} style={{ ...inputStyle, width: '100%' }} />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>
          Domains &amp; target weights{' '}
          <span style={{ fontWeight: 400, color: Math.abs(weightSum - 100) > 1 ? '#c0392b' : '#666' }}>(sum: {weightSum}, should be ~100)</span>
        </label>
        {domains.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <input
              value={d.name}
              onChange={(e) => updateDomain(i, { name: e.target.value })}
              placeholder="Domain name"
              style={{ ...inputStyle, flex: '1 1 auto' }}
            />
            <input
              type="number"
              min={0}
              max={100}
              value={d.targetWeight}
              onChange={(e) => updateDomain(i, { targetWeight: Number(e.target.value) })}
              placeholder="%"
              style={{ ...inputStyle, width: 80 }}
            />
            <button type="button" onClick={() => removeDomain(i)} disabled={domains.length <= 1}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setDomains((prev) => [...prev, { name: '', targetWeight: 0 }])}>
          + Add domain
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Objectives (optional here — can be added later via ingestion/generation too)</label>
        {objectives.map((o, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <input
              value={o.number}
              onChange={(e) => updateObjective(i, { number: e.target.value })}
              placeholder="e.g. 1.2"
              style={{ ...inputStyle, width: 80 }}
            />
            <input
              value={o.title}
              onChange={(e) => updateObjective(i, { title: e.target.value })}
              placeholder="Title (optional)"
              style={{ ...inputStyle, flex: '1 1 auto' }}
            />
            <select value={o.domain} onChange={(e) => updateObjective(i, { domain: e.target.value })} style={inputStyle}>
              <option value="">Domain...</option>
              {domains
                .filter((d) => d.name.trim() !== '')
                .map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
            </select>
            <button type="button" onClick={() => removeObjective(i)}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setObjectives((prev) => [...prev, { number: '', title: '', domain: domains[0]?.name ?? '' }])}
          disabled={domains.every((d) => d.name.trim() === '')}
        >
          + Add objective
        </button>
      </div>

      {issues && (
        <div style={{ background: '#fdf4f4', border: '1px solid #f0c4c4', borderRadius: 6, padding: 12, marginBottom: 16 }}>
          <p style={{ fontWeight: 600, color: '#c0392b', marginBottom: 6 }}>Can&apos;t create — fix these first:</p>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#c0392b' }}>
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create certification'}
      </button>
    </form>
  );
}
