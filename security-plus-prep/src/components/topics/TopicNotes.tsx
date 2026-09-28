'use client';

import { useState } from 'react';
import { saveTopicNote } from '@/lib/topic-notes';

export function TopicNotes({ objective, initialContent }: { objective: string; initialContent: string }) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = content !== initialContent;

  async function handleSave() {
    setSaving(true);
    try {
      await saveTopicNote(objective, content);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>My notes</h3>
        {!dirty && savedAt && <span style={{ fontSize: 12, color: 'var(--accent)' }}>Saved</span>}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write anything worth remembering about this topic..."
        rows={6}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid var(--card-border)',
          font: 'inherit',
          fontSize: 14,
          resize: 'vertical',
          marginBottom: 8,
        }}
      />
      <button type="button" className="btn" onClick={handleSave} disabled={saving || !dirty}>
        {saving ? 'Saving...' : 'Save notes'}
      </button>
    </div>
  );
}
