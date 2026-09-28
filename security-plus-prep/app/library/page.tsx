import Link from 'next/link';

// Placeholder — the PDF library (upload to Blob, in-app viewer, topic
// linking) lands in Step 2 of the home-restructure build. Ships as a real
// 200 page now so Section 2's nav tile works from Step 1 onward; this gets
// replaced in place, same route.
export default function LibraryPlaceholderPage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/">&larr; Back to dashboard</Link>
      </p>
      <h1>Library</h1>
      <p style={{ color: '#666', marginTop: 12 }}>
        Coming soon — upload your source PDFs and read them in-app, linked straight from each topic page.
      </p>
    </main>
  );
}
