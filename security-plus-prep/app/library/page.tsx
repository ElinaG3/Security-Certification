import Link from 'next/link';
import { listPdfs } from './actions';
import { UploadPdfForm } from '@/components/library/UploadPdfForm';

// listPdfs reads live, cert-scoped data — no searchParams/cookies to
// otherwise signal dynamic rendering, so without this Next would
// statically prerender a stale snapshot at build time (same class of bug
// fixed on /review, /topics, and the home dashboard).
export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const pdfs = await listPdfs();

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/">&larr; Back to dashboard</Link>
      </p>
      <h1>Library</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Upload source PDFs to read in-app. Uploading also chunks and embeds the content — it becomes available for topics,
        search, and card generation, but generating cards from it is a separate step.
      </p>

      <UploadPdfForm />

      {pdfs.length === 0 ? (
        <p style={{ color: '#666' }}>No PDFs uploaded yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {pdfs.map((pdf) => (
            <li key={pdf.id} style={{ marginBottom: 8 }}>
              <Link
                href={`/library/${pdf.id}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 12px', border: '1px solid #eee', borderRadius: 8, gap: 8, flexWrap: 'wrap' }}
              >
                <span style={{ fontWeight: 600 }}>{pdf.filename}</span>
                <span style={{ fontSize: 12, color: '#999' }}>
                  {pdf.pageCount} page{pdf.pageCount === 1 ? '' : 's'} · {pdf.chunkCount} chunk{pdf.chunkCount === 1 ? '' : 's'} ·{' '}
                  {new Date(pdf.uploadedAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
