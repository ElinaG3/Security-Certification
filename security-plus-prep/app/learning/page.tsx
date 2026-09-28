import Link from 'next/link';

// Placeholder — the Guided Learning Session (Core C1-C4, Extended E1-E8)
// lands in Steps 4-5 of the home-restructure build. Ships as a real 200
// page now, not a dead link, so Section 2's nav tile works from Step 1
// onward; this gets replaced in place, same route.
export default function LearningPlaceholderPage() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/">&larr; Back to dashboard</Link>
      </p>
      <h1>Guided Learning Session</h1>
      <p style={{ color: '#666', marginTop: 12 }}>
        Coming soon — a structured session (free recall, typed-answer cards, error log, hands-on practice) for actually
        learning new material, not just reviewing what you already know.
      </p>
    </div>
  );
}
