'use client';

import { useState } from 'react';
import { addNote, updateNote, deleteNote, type NoteEntry } from '@/lib/topic-note-entries';

export function NotesPanel({
  objective,
  initialNotes,
  variant,
}: {
  objective: string;
  initialNotes: NoteEntry[];
  variant: 'mobile' | 'desktop';
}) {
  const [notes, setNotes] = useState<NoteEntry[]>(initialNotes);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  // Only meaningful for the mobile (collapsible) variant — the desktop
  // panel always shows its full content.
  const [expanded, setExpanded] = useState(initialNotes.length <= 1);

  async function handleAdd() {
    if (!draft.trim() || adding) return;
    setAdding(true);
    setError(null);
    const result = await addNote(objective, draft);
    setAdding(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotes((prev) => [result.note, ...prev]);
    setDraft('');
  }

  function handleDraftKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  async function handleSaveEdit(id: string) {
    const result = await updateNote(id, editDraft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === id ? result.note : n)));
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this note?')) return;
    const result = await deleteNote(id);
    if (result.ok) setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  const body = (
    <>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleDraftKeyDown}
        placeholder="Add a note..."
        rows={3}
        maxLength={2000}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--card-border)', font: 'inherit', fontSize: 13, resize: 'vertical', marginBottom: 8 }}
      />
      <button type="button" className="btn btn-primary" onClick={handleAdd} disabled={adding || !draft.trim()} style={{ marginBottom: 14 }}>
        {adding ? 'Adding...' : 'Add'}
      </button>
      {error && <p style={{ color: '#c0392b', fontSize: 12, marginBottom: 10 }}>{error}</p>}

      {notes.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Write it in your own words — it sticks better.</p>
      ) : (
        <div className="notes-scroll">
          {notes.map((n) => (
            <div key={n.id} className="sticky-note">
              {editingId === n.id ? (
                <>
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    style={{ width: '100%', fontSize: 14, fontFamily: 'inherit', marginBottom: 8, borderRadius: 6, border: '1px solid var(--card-border)', padding: 6 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn" style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }} onClick={() => handleSaveEdit(n.id)}>
                      Save
                    </button>
                    <button type="button" className="btn" style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }} onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="sticky-note-body">{n.body}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span className="sticky-note-time">{new Date(n.updatedAt).toLocaleDateString()}</span>
                    <div style={{ display: 'flex' }}>
                      <button
                        type="button"
                        className="sticky-note-action"
                        onClick={() => {
                          setEditingId(n.id);
                          setEditDraft(n.body);
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" className="sticky-note-action" onClick={() => handleDelete(n.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (variant === 'mobile') {
    return (
      <div className="card notes-section notes-section-mobile" style={{ padding: 20 }}>
        <button type="button" className="notes-toggle" onClick={() => setExpanded((e) => !e)}>
          <span>My notes ({notes.length})</span>
          <span>{expanded ? '▲' : '▼'}</span>
        </button>
        {expanded && <div style={{ marginTop: 14 }}>{body}</div>}
      </div>
    );
  }

  return (
    <div className="notes-section notes-section-desktop">
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>My notes ({notes.length})</h3>
      {body}
    </div>
  );
}
