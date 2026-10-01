import type { StudySheetBlock, StudySheetContent, StudySheetSection, CalloutKind } from '@/lib/study-sheet-generation';

const CALLOUT_STYLE: Record<CalloutKind, { border: string; bg: string; label: string }> = {
  examtip: { border: 'var(--accent)', bg: 'var(--accent-tint)', label: 'Exam tip' },
  watchout: { border: '#c0392b', bg: '#fdf4f4', label: 'Watch out' },
  example: { border: '#5b7c99', bg: '#eef2f5', label: 'Example' },
  remember: { border: '#2e7d32', bg: '#eaf5ec', label: 'Remember' },
};

// Comfortable line length regardless of the surrounding column's own
// width — tables are exempt, they use the full available width.
const PROSE_STYLE: React.CSSProperties = { maxWidth: '75ch', overflowWrap: 'break-word', fontSize: 16, lineHeight: 1.6 };

function Block({ block }: { block: StudySheetBlock }) {
  switch (block.type) {
    case 'paragraph':
      return <p style={{ ...PROSE_STYLE, margin: '0 0 12px' }}>{block.text}</p>;

    case 'bullets':
      return (
        <ul style={{ ...PROSE_STYLE, margin: '0 0 12px', paddingLeft: 22 }}>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );

    case 'steps':
      return (
        <ol style={{ ...PROSE_STYLE, maxWidth: 'none', margin: '0 0 12px', paddingLeft: 22 }}>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );

    case 'term':
      return (
        <p style={{ ...PROSE_STYLE, margin: '0 0 12px' }}>
          <strong style={{ color: 'var(--accent)' }}>{block.term}</strong> — {block.definition}
        </p>
      );

    case 'table': {
      return (
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 15 }}>
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--card-border)', fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: '8px 10px', borderBottom: '1px solid var(--card-border)' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'callout': {
      const style = CALLOUT_STYLE[block.kind];
      return (
        <div
          style={{
            ...PROSE_STYLE,
            borderLeft: `4px solid ${style.border}`,
            background: style.bg,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12,
          }}
        >
          <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 700, color: style.border, textTransform: 'uppercase', letterSpacing: 0.4 }}>{style.label}</p>
          <p style={{ margin: 0, lineHeight: 1.55 }}>{block.text}</p>
        </div>
      );
    }
  }
}

function Section({ section, isFirst }: { section: StudySheetSection; isFirst: boolean }) {
  return (
    <div style={{ marginBottom: 24, paddingTop: isFirst ? 0 : 20, borderTop: isFirst ? 'none' : '1px solid var(--card-border)' }}>
      <h3 style={{ fontSize: 18, color: 'var(--accent)', marginBottom: 10 }}>
        {section.emoji} {section.heading}
      </h3>
      {section.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

// One flowing column — sections are separated by a thin divider + spacing,
// not boxed cards, and never split into a 2-column layout.
export function StudySheetRenderer({ sheet }: { sheet: StudySheetContent }) {
  return (
    <div>
      {sheet.sections.map((section, i) => (
        <Section key={i} section={section} isFirst={i === 0} />
      ))}
    </div>
  );
}
