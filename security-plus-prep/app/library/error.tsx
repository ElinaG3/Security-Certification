'use client';

// Route-level error boundary for /library. A malformed Server Action
// response (e.g. the function crashing at module-resolution time, before
// it can return a normal {ok:false} result) bypasses UploadPdfForm's own
// try/catch entirely and would otherwise show React's raw crash overlay —
// which is exactly the "never an endless spinner, but also never a raw
// crash" gap this closes. This is not the primary error path (that's
// UploadPdfForm's own state machine); it's the fallback for the failure
// modes that path can't catch.
export default function LibraryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 0' }}>
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Something went wrong loading the Library.</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{error.message || 'An unexpected error occurred.'}</p>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
