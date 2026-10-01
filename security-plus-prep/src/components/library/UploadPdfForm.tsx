'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { ingestUploadedPdf } from '../../../app/library/actions';

type Phase =
  | { kind: 'idle' }
  | { kind: 'uploading'; percent: number }
  | { kind: 'processing' }
  | { kind: 'done'; pageCount: number; chunkCount: number }
  | { kind: 'error'; message: string };

// One control: selecting a file starts the upload immediately — no
// separate Browse-then-Upload step. Three real phases (uploading with a
// live percent, then processing, then done) instead of a spinner that
// never resolves, per the earlier hang on a ~10MB PDF (the file was never
// actually reaching the server, and no error ever surfaced).
export function UploadPdfForm({ certificationId }: { certificationId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setPhase({ kind: 'error', message: 'Only PDF files are accepted.' });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setPhase({ kind: 'uploading', percent: 0 });
    const pathname = `library/${certificationId}/${crypto.randomUUID()}-${file.name}`;

    try {
      const blob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/library/upload',
        onUploadProgress: ({ percentage }) => {
          setPhase({ kind: 'uploading', percent: Math.round(percentage) });
        },
      });

      setPhase({ kind: 'processing' });
      const result = await ingestUploadedPdf({ blobUrl: blob.url, filename: file.name });

      if (!result.ok) {
        setPhase({ kind: 'error', message: result.issue });
        return;
      }

      setPhase({ kind: 'done', pageCount: result.pageCount, chunkCount: result.chunkCount });
      router.refresh();
    } catch (err) {
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'Upload failed.' });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const busy = phase.kind === 'uploading' || phase.kind === 'processing';

  return (
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      <label
        className="btn btn-primary"
        style={{ cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, display: 'inline-flex' }}
      >
        {busy ? 'Working...' : 'Upload PDF'}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={busy}
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}
        />
      </label>

      {phase.kind === 'uploading' && (
        <div style={{ marginTop: 12, maxWidth: 320 }}>
          <div className="bar-track" style={{ marginBottom: 6 }}>
            <div className="bar-fill" style={{ width: `${phase.percent}%`, transition: 'width 0.15s ease' }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Uploading — {phase.percent}%</p>
        </div>
      )}

      {phase.kind === 'processing' && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>Processing (chunking &amp; embedding)...</p>
      )}

      {phase.kind === 'done' && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--accent)' }}>
          Done — {phase.pageCount} page{phase.pageCount === 1 ? '' : 's'}, {phase.chunkCount} chunk{phase.chunkCount === 1 ? '' : 's'}.
        </p>
      )}

      {phase.kind === 'error' && <p style={{ marginTop: 12, fontSize: 13, color: '#c0392b' }}>{phase.message}</p>}
    </div>
  );
}
