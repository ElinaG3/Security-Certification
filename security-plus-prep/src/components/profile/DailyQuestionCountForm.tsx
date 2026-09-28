'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setDailyQuestionCount } from '@/lib/profile-settings';

export function DailyQuestionCountForm({ initialCount, isDefault }: { initialCount: number; isDefault: boolean }) {
  const [value, setValue] = useState(String(initialCount));
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    setSaving(true);
    try {
      await setDailyQuestionCount(Math.round(n));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Daily questions {isDefault && <span style={{ fontWeight: 400 }}>(default)</span>}
        </label>
        <input
          type="number"
          min={1}
          max={200}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ minHeight: 44, width: 100, padding: '0 12px', borderRadius: 10, border: '1px solid var(--card-border)', font: 'inherit', fontSize: 14 }}
        />
      </div>
      <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
