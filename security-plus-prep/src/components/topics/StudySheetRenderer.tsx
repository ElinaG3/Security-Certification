import type { StudySheetBlock, StudySheetContent, StudySheetSection, CalloutKind } from '@/lib/study-sheet-generation';

const CALLOUT_STYLE: Record<CalloutKind, { border: string; bg: string; label: string }> = {
  examtip: { border: 'var(--accent)', bg: 'var(--accent-tint)', label: 'Exam tip' },
  watchout: { border: '#c0392b', bg: '#fdf4f4', label: 'Watch out' },
  example: { border: '#5b7c99', bg: '#eef2f5', label: 'Example' },
  remember: { border: '#2e7d32', bg: '#eaf5ec', label: 'Remember' },
};

// Comfortable line length for actual prose/lists, independent of how wide
// the section card itself is (1 or 2 grid columns) — tables are exempt,
// they need the card's full width.
const PROSE_STYLE: React.CSSProperties = { maxWidth: '70ch', overflowWrap: 'break-word' };

function Block({ block }: { block: StudySheetBlock }) {
  switch (block.type) {
    case 'paragraph':
      return <p style={{ ...PROSE_STYLE, margin: '0 0 8px', lineHeight: 1.65 }}>{block.text}</p>;

    case 'bullets':
      return (
        <ul style={{ ...PROSE_STYLE, margin: '0 0 8px', paddingLeft: 20, lineHeight: 1.65 }}>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );

    case 'steps':
      return (
        <ol style={{ ...PROSE_STYLE, margin: '0 0 8px', paddingLeft: 20, lineHeight: 1.65 }}>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );

    case 'term':
      return (
        <p style={{ ...PROSE_STYLE, margin: '0 0 8px', lineHeight: 1.65 }}>
          <strong style={{ color: 'var(--accent)' }}>{block.term}</strong> — {block.definition}
        </p>
      );

    case 'table': {
      return (
        <div style={{ overflowX: 'auto', marginBottom: 8 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
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
            padding: '8px 12px',
            marginBottom: 8,
          }}
        >
          <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: style.border, textTransform: 'uppercase', letterSpacing: 0.4 }}>{style.label}</p>
          <p style={{ margin: 0, lineHeight: 1.55 }}>{block.text}</p>
        </div>
      );
    }
  }
}

// Tables and long step lists get the full card width (both grid columns
// at >=1100px) rather than being squeezed into one column.
function spansBothColumns(section: StudySheetSection): boolean {
  return section.blocks.some((b) => b.type === 'table' || (b.type === 'steps' && b.items.length > 4));
}

function Section({ section }: { section: StudySheetSection }) {
  const spanBoth = spansBothColumns(section);
  return (
    <div className={`study-sheet-section-card${spanBoth ? ' study-sheet-section-span' : ''}`}>
      <h3 style={{ fontSize: 16, color: 'var(--accent)', marginBottom: 8 }}>
        {section.emoji} {section.heading}
      </h3>
      {section.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

export function StudySheetRenderer({ sheet }: { sheet: StudySheetContent }) {
  return (
    <div className="study-sheet-sections">
      {sheet.sections.map((section, i) => (
        <Section key={i} section={section} />
      ))}
    </div>
  );
}
