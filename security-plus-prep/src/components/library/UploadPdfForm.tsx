'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { uploadPdf } from '../../../app/library/actions';

export function UploadPdfForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setLastResult(null);
    const result = await uploadPdf(file);
    setUploading(false);

    if (!result.ok) {
      setError(result.issue);
      return;
    }
    setLastResult(`Uploaded — ${result.chunkCount} chunk(s) ingested and embedded.`);
    if (fileInputRef.current) fileInputRef.current.value = '';
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input ref={fileInputRef} type="file" accept="application/pdf" disabled={uploading} />
        <button type="submit" disabled={uploading}>
          {uploading ? 'Uploading & chunking...' : 'Upload PDF'}
        </button>
      </div>
      {uploading && (
        <p style={{ fontSize: 12, color: '#999', marginTop: 6 }}>
          Extracting text, chunking, and embedding — this can take a little while for a long document.
        </p>
      )}
      {error && <p style={{ color: '#c0392b', fontSize: 13, marginTop: 6 }}>{error}</p>}
      {lastResult && <p style={{ color: '#2e7d32', fontSize: 13, marginTop: 6 }}>{lastResult}</p>}
    </form>
  );
}
