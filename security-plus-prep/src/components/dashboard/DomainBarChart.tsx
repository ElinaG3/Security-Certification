'use client';

import { Bar, BarChart, Cell, LabelList, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export interface DomainBarDatum {
  domain: string;
  value: number | null; // 0-1, or null = no data yet — never coerced to 0%, which would misrepresent "unstudied" as "failing"
  sublabel?: string; // e.g. "target 28%" or "12/44 reviewed"
}

const NO_DATA_COLOR = '#d9d9d9';

// Single-hue, single-series bar chart — retention and recall accuracy are
// always rendered as two SEPARATE instances of this component (different
// `color`), never combined into one chart or one axis. Horizontal layout
// because domain names (e.g. "Security Program Management and Oversight")
// are long. Null values get their own muted color and "no data yet" label
// instead of being coerced to a 0% bar.
export function DomainBarChart({ data, color, height = 220 }: { data: DomainBarDatum[]; color: string; height?: number }) {
  const chartData = data.map((d) => ({
    ...d,
    percent: d.value === null ? 0 : Math.round(d.value * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="domain"
          width={170}
          tick={{ fontSize: 12, fill: '#444' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={((_value: unknown, _name: unknown, item: { payload?: DomainBarDatum }) => {
            const d = item?.payload;
            if (!d || d.value === null) return ['No data yet', ''];
            return [`${Math.round(d.value * 100)}%`, d.sublabel ?? ''];
          }) as never}
        />
        <Bar dataKey="percent" radius={[0, 4, 4, 0]} barSize={16}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.value === null ? NO_DATA_COLOR : color} />
          ))}
          <LabelList
            dataKey="percent"
            position="right"
            content={((props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number }) => {
              const x = Number(props.x ?? 0);
              const y = Number(props.y ?? 0);
              const width = Number(props.width ?? 0);
              const height = Number(props.height ?? 0);
              const d = chartData[props.index ?? -1];
              if (!d) return null;
              const text = d.value === null ? 'no data yet' : `${Math.round(d.value * 100)}%`;
              return (
                <text x={x + width + 6} y={y + height / 2} dy={4} fontSize={12} fill={d.value === null ? '#999' : '#333'}>
                  {text}
                  {d.sublabel ? ` · ${d.sublabel}` : ''}
                </text>
              );
            }) as never}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
