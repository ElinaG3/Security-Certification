import type { StudySheetBlock, StudySheetContent, StudySheetSection, CalloutKind } from '@/lib/study-sheet-generation';

const CALLOUT_STYLE: Record<CalloutKind, { border: string; bg: string; label: string }> = {
  examtip: { border: 'var(--accent)', bg: 'var(--accent-tint)', label: 'Exam tip' },
  watchout: { border: '#c0392b', bg: '#fdf4f4', label: 'Watch out' },
  example: { border: '#5b7c99', bg: '#eef2f5', label: 'Example' },
  remember: { border: '#2e7d32', bg: '#eaf5ec', label: 'Remember' },
};

function Block({ block }: { block: StudySheetBlock }) {
  switch (block.type) {
    case 'paragraph':
      return <p style={{ margin: '0 0 12px', lineHeight: 1.7 }}>{block.text}</p>;

    case 'bullets':
      return (
        <ul style={{ margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.7 }}>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );

    case 'steps':
      return (
        <ol style={{ margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.7 }}>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );

    case 'term':
      return (
        <p style={{ margin: '0 0 12px', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--accent)' }}>{block.term}</strong> — {block.definition}
        </p>
      );

    case 'table': {
      return (
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
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
            borderLeft: `4px solid ${style.border}`,
            background: style.bg,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12,
          }}
        >
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: style.border, textTransform: 'uppercase', letterSpacing: 0.4 }}>{style.label}</p>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{block.text}</p>
        </div>
      );
    }
  }
}

function Section({ section }: { section: StudySheetSection }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 17, color: 'var(--accent)', marginBottom: 10 }}>
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
    <div style={{ maxWidth: '70ch', fontSize: 14 }}>
      {sheet.sections.map((section, i) => (
        <Section key={i} section={section} />
      ))}
    </div>
  );
}
