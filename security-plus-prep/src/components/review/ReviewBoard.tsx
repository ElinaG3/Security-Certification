'use client';

import { useRef, useState } from 'react';
import {
  approveCard,
  rejectCard,
  setCardFlag,
  updateCardContent,
  listActiveCards,
  type ReviewCard,
  type UpdateCardInput,
} from '../../../app/review/actions';
import { CardEditorFields, type EditableCard } from './CardEditorFields';

type ChoiceReviewCard = Extract<ReviewCard, { type: 'multiple_choice' | 'multiple_select' }>;
type FillInReviewCard = Extract<ReviewCard, { type: 'fill_in' }>;

function toEditable(card: ChoiceReviewCard): EditableCard {
  const correct = Array.isArray(card.content.correct) ? card.content.correct : [card.content.correct];
  return {
    topic: card.topic,
    question: card.content.question,
    options: [...card.content.options],
    correct: [...correct],
    explanation: card.content.explanation,
    distractorExplanations: [...(card.content.distractorExplanations ?? card.content.options.map(() => ''))],
  };
}

function toUpdateInput(draft: EditableCard, type: 'multiple_choice' | 'multiple_select'): UpdateCardInput {
  return {
    topic: draft.topic,
    question: draft.question,
    options: draft.options,
    correct: draft.correct,
    requiredCount: type === 'multiple_select' ? draft.correct.length : undefined,
    explanation: draft.explanation,
    distractorExplanations: draft.distractorExplanations,
  };
}

// Keyboard shortcuts, active only while a section's list container has
// focus (click/tab into it) — j/k navigate so typing elsewhere on the page
// (search box, edit fields) never triggers these.
const SHORTCUTS_HELP = 'j/k or ↓/↑ move · Enter/e expand · s save';

type CardRowProps = {
  card: ReviewCard;
  mode: 'pending' | 'active';
  expanded: boolean;
  onToggleExpand: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onToggleFlag?: () => void;
  onSave: (input: UpdateCardInput) => Promise<{ ok: true } | { ok: false; issues: string[] }>;
};

// Dispatches to a read-only row for fill_in (no options/correct shape to
// edit — see updateCardContent, which only ever supports multiple_choice/
// multiple_select) or the full editor row for everything else. Kept as two
// components rather than one branching component so each can call its own
// hooks unconditionally.
function CardRow(props: CardRowProps) {
  if (props.card.type === 'fill_in') return <FillInCardRow {...props} card={props.card} />;
  return <ChoiceCardRow {...props} card={props.card} />;
}

function FillInCardRow({ card, mode, expanded, onToggleExpand, onApprove, onReject }: CardRowProps & { card: FillInReviewCard }) {
  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: 8,
        marginBottom: 8,
        background: card.flagged ? '#fdf4f4' : '#fff',
      }}
    >
      <div
        role="button"
        tabIndex={-1}
        onClick={onToggleExpand}
        style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}
      >
        <span style={{ fontSize: 14 }}>
          {card.flagged && '🚩 '}
          <strong>{card.topic}</strong>
          <span style={{ color: '#666' }}> — {card.domain}</span>
          <span style={{ color: '#666' }}> (typed answer, {card.content.gradingMode})</span>
        </span>
        <span style={{ fontSize: 12, color: '#999' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 12px', fontSize: 13 }}>
          <p style={{ color: '#666', marginBottom: 8 }}>{card.content.question}</p>
          <p style={{ marginBottom: 4 }}>
            <strong>{card.content.gradingMode === 'exact' ? 'Accepted answers:' : 'Key points:'}</strong>{' '}
            {card.content.acceptedAnswers.join(' · ')}
          </p>
          <p style={{ color: '#666', marginBottom: 10 }}>{card.content.explanation}</p>

          {mode === 'pending' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onApprove} style={{ color: '#2e7d32' }}>
                Approve (a)
              </button>
              <button type="button" onClick={onReject} style={{ color: '#c0392b' }}>
                Reject (r)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChoiceCardRow({ card, mode, expanded, onToggleExpand, onApprove, onReject, onToggleFlag, onSave }: CardRowProps & { card: ChoiceReviewCard }) {
  const [draft, setDraft] = useState<EditableCard>(() => toEditable(card));
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<string[] | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSave() {
    setSaving(true);
    setIssues(null);
    const result = await onSave(toUpdateInput(draft, card.type));
    setSaving(false);
    if (!result.ok) {
      setIssues(result.issues);
      return;
    }
    setSavedAt(Date.now());
  }

  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: 8,
        marginBottom: 8,
        background: card.flagged ? '#fdf4f4' : '#fff',
      }}
    >
      <div
        role="button"
        tabIndex={-1}
        onClick={onToggleExpand}
        style={{
          padding: '10px 12px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          alignItems: 'baseline',
        }}
      >
        <span style={{ fontSize: 14 }}>
          {card.flagged && '🚩 '}
          <strong>{card.topic}</strong>
          <span style={{ color: '#666' }}> — {card.domain}</span>
          {card.type === 'multiple_select' && <span style={{ color: '#666' }}> (multi-select)</span>}
        </span>
        <span style={{ fontSize: 12, color: '#999' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 12px' }}>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>{card.content.question}</p>
          <CardEditorFields value={draft} onChange={setDraft} type={card.type} />

          {issues && (
            <div style={{ background: '#fdf4f4', border: '1px solid #f0c4c4', borderRadius: 6, padding: 10, marginTop: 10 }}>
              <p style={{ fontWeight: 600, color: '#c0392b', marginBottom: 4, fontSize: 13 }}>Can&apos;t save:</p>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#c0392b', fontSize: 13 }}>
                {issues.map((iss, i) => (
                  <li key={i}>{iss}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save (s)'}
            </button>
            {mode === 'pending' && (
              <>
                <button type="button" onClick={onApprove} style={{ color: '#2e7d32' }}>
                  Approve (a)
                </button>
                <button type="button" onClick={onReject} style={{ color: '#c0392b' }}>
                  Reject (r)
                </button>
              </>
            )}
            {mode === 'active' && (
              <button type="button" onClick={onToggleFlag}>
                {card.flagged ? 'Unflag (f)' : 'Flag (f)'}
              </button>
            )}
            {savedAt && (
              <span style={{ color: '#2e7d32', fontSize: 13 }} key={savedAt}>
                Saved
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PendingSection({ initial }: { initial: ReviewCard[] }) {
  const [items, setItems] = useState<ReviewCard[]>(initial);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function moveFocus(delta: number) {
    setFocusIndex((i) => Math.max(0, Math.min(items.length - 1, i + delta)));
  }

  async function handleApprove(id: string) {
    await approveCard(id);
    setItems((prev) => prev.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function handleReject(id: string) {
    await rejectCard(id);
    setItems((prev) => prev.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return; // never intercept while typing
    const focused = items[focusIndex];
    if (!focused) return;

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(-1);
    } else if (e.key === 'Enter' || e.key === 'e') {
      e.preventDefault();
      setExpandedId((id) => (id === focused.id ? null : focused.id));
    } else if (e.key === 'a') {
      e.preventDefault();
      handleApprove(focused.id);
    } else if (e.key === 'r') {
      e.preventDefault();
      handleReject(focused.id);
    } else if (e.key === 'Escape') {
      setExpandedId(null);
    }
  }

  if (items.length === 0) {
    return <p style={{ color: '#666' }}>Nothing pending — every generated card either auto-approved or was already handled here.</p>;
  }

  return (
    <div ref={containerRef} tabIndex={0} onKeyDown={onKeyDown} style={{ outline: 'none' }}>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>{SHORTCUTS_HELP} · a approve · r reject (click here first, or Tab in)</p>
      {items.map((card, i) => (
        <div key={card.id} style={{ outline: i === focusIndex ? '2px solid #4a90d9' : 'none', borderRadius: 8 }}>
          <CardRow
            card={card}
            mode="pending"
            expanded={expandedId === card.id}
            onToggleExpand={() => {
              setFocusIndex(i);
              setExpandedId((id) => (id === card.id ? null : card.id));
            }}
            onApprove={() => handleApprove(card.id)}
            onReject={() => handleReject(card.id)}
            onSave={(input) => updateCardContent(card.id, input)}
          />
        </div>
      ))}
    </div>
  );
}

function ActiveSection({
  domains,
  initial,
  initialTotal,
  initialFlaggedOnly = false,
}: {
  domains: readonly string[];
  initial: ReviewCard[];
  initialTotal: number;
  initialFlaggedOnly?: boolean;
}) {
  const [items, setItems] = useState<ReviewCard[]>(initial);
  const [total, setTotal] = useState(initialTotal);
  const [domain, setDomain] = useState('');
  const [query, setQuery] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(initialFlaggedOnly);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const PAGE_SIZE = 20;

  async function refetch(next: { domain?: string; query?: string; flaggedOnly?: boolean; offset?: number } = {}) {
    setLoading(true);
    const d = next.domain ?? domain;
    const q = next.query ?? query;
    const f = next.flaggedOnly ?? flaggedOnly;
    const o = next.offset ?? offset;
    const result = await listActiveCards({ domain: d || undefined, query: q || undefined, flaggedOnly: f, offset: o });
    setItems(result.cards);
    setTotal(result.total);
    setFocusIndex(0);
    setLoading(false);
  }

  function moveFocus(delta: number) {
    setFocusIndex((i) => Math.max(0, Math.min(items.length - 1, i + delta)));
  }

  async function handleToggleFlag(card: ReviewCard) {
    const next = !card.flagged;
    await setCardFlag(card.id, next);
    setItems((prev) => prev.map((c) => (c.id === card.id ? { ...c, flagged: next } : c)));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const focused = items[focusIndex];
    if (!focused) return;

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(-1);
    } else if (e.key === 'Enter' || e.key === 'e') {
      e.preventDefault();
      setExpandedId((id) => (id === focused.id ? null : focused.id));
    } else if (e.key === 'f') {
      e.preventDefault();
      handleToggleFlag(focused);
    } else if (e.key === 'Escape') {
      setExpandedId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            refetch({ domain: e.target.value, offset: 0 });
            setOffset(0);
          }}
          style={{ padding: '6px 8px' }}
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input
          placeholder="Search topic/question..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              refetch({ query, offset: 0 });
              setOffset(0);
            }
          }}
          style={{ padding: '6px 8px', flex: '1 1 200px' }}
        />
        <button
          type="button"
          onClick={() => {
            refetch({ query, offset: 0 });
            setOffset(0);
          }}
        >
          Search
        </button>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => {
              setFlaggedOnly(e.target.checked);
              refetch({ flaggedOnly: e.target.checked, offset: 0 });
              setOffset(0);
            }}
          />
          Flagged only
        </label>
      </div>

      <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
        {SHORTCUTS_HELP} · f flag/unflag (click here first, or Tab in) · {total} card(s) match
      </p>

      {loading ? (
        <p style={{ color: '#666' }}>Loading...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#666' }}>No matching active cards.</p>
      ) : (
        <div tabIndex={0} onKeyDown={onKeyDown} style={{ outline: 'none' }}>
          {items.map((card, i) => (
            <div key={card.id} style={{ outline: i === focusIndex ? '2px solid #4a90d9' : 'none', borderRadius: 8 }}>
              <CardRow
                card={card}
                mode="active"
                expanded={expandedId === card.id}
                onToggleExpand={() => {
                  setFocusIndex(i);
                  setExpandedId((id) => (id === card.id ? null : card.id));
                }}
                onToggleFlag={() => handleToggleFlag(card)}
                onSave={(input) => updateCardContent(card.id, input)}
              />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          disabled={offset === 0 || loading}
          onClick={() => {
            const next = Math.max(0, offset - PAGE_SIZE);
            setOffset(next);
            refetch({ offset: next });
          }}
        >
          Prev
        </button>
        <button
          type="button"
          disabled={offset + PAGE_SIZE >= total || loading}
          onClick={() => {
            const next = offset + PAGE_SIZE;
            setOffset(next);
            refetch({ offset: next });
          }}
        >
          Next
        </button>
        <span style={{ fontSize: 13, color: '#666', alignSelf: 'center' }}>
          {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
        </span>
      </div>
    </div>
  );
}

export function ReviewBoard({
  pending,
  activeInitial,
  activeTotal,
  domains,
  initialFlaggedOnly = false,
}: {
  pending: ReviewCard[];
  activeInitial: ReviewCard[];
  activeTotal: number;
  domains: readonly string[];
  initialFlaggedOnly?: boolean;
}) {
  return (
    <div>
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Pending approval ({pending.length})</h2>
        <PendingSection initial={pending} />
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Active cards — spot-check</h2>
        <ActiveSection domains={domains} initial={activeInitial} initialTotal={activeTotal} initialFlaggedOnly={initialFlaggedOnly} />
      </section>
    </div>
  );
}
