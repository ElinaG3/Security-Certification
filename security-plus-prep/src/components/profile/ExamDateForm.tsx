'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setExamDate } from '@/lib/profile-settings';

function toInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '';
}

export function ExamDateForm({ initialDate }: { initialDate: Date | null }) {
  const [value, setValue] = useState(toInputValue(initialDate));
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    try {
      await setExamDate(value ? new Date(`${value}T00:00:00Z`) : null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Exam date</label>
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1px solid var(--card-border)', font: 'inherit', fontSize: 14 }}
        />
      </div>
      <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
