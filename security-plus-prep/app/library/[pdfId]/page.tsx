import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPdf } from '../actions';

export const dynamic = 'force-dynamic';

// Browser-native PDF viewing via an <iframe> — no PDF.js needed. Every
// major browser's built-in PDF viewer honors a #page=N fragment on the
// URL, which is how topic pages link straight to the relevant page.
export default async function PdfViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ pdfId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { pdfId } = await params;
  const { page } = await searchParams;
  const pdf = await getPdf(pdfId);
  if (!pdf) notFound();

  const pageNum = page ? Number(page) : null;
  const viewerSrc = pageNum && pageNum > 0 ? `${pdf.blobUrl}#page=${pageNum}` : pdf.blobUrl;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ marginBottom: 4 }}>
            <Link href="/library">&larr; Library</Link>
          </p>
          <h1 style={{ fontSize: 18, margin: 0 }}>{pdf.filename}</h1>
        </div>
        {pageNum && <span style={{ fontSize: 13, color: '#666' }}>Opened at page {pageNum}</span>}
      </div>
      <iframe
        src={viewerSrc}
        title={pdf.filename}
        style={{ width: '100%', height: 'calc(100vh - 140px)', border: '1px solid #ddd', borderRadius: 8 }}
      />
    </div>
  );
}
