'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

// Pointer Events (not mouse/touch events) so this works uniformly with an
// Apple Pencil on iPad Safari and a mouse on desktop — a single event model
// covers both, including pressure via e.pressure where the device reports it.

type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; size: number; tool: 'pen' | 'eraser' };

const COLORS = ['#1a1a1a', '#c0392b', '#2e6da4', '#2e7d32', '#b8860b'];
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 380;

export interface DrawingCanvasHandle {
  isEmpty: () => boolean;
  exportPng: () => Promise<File>;
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, { locked?: boolean }>(function DrawingCanvas({ locked }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

  function redraw(allStrokes: Stroke[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  // The canvas element's CSS size (rect.width/height) can differ from its
  // internal pixel resolution (CANVAS_WIDTH/HEIGHT) — it scales responsively
  // via CSS `width: 100%`. Without this scale factor, points land at the
  // CSS-pixel position instead of the canvas-pixel position, misaligning
  // every stroke on any screen narrower than CANVAS_WIDTH (e.g. an iPad).
  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    currentStroke.current = {
      points: [pointFromEvent(e)],
      color,
      size: tool === 'eraser' ? 18 : 3,
      tool,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (locked || !currentStroke.current) return;
    currentStroke.current.points.push(pointFromEvent(e));
    redraw([...strokes, currentStroke.current]);
  }

  function finishStroke() {
    if (!currentStroke.current) return;
    const finished = currentStroke.current;
    currentStroke.current = null;
    if (finished.points.length >= 2) {
      setStrokes((prev) => {
        const next = [...prev, finished];
        redraw(next);
        return next;
      });
    }
  }

  function undo() {
    setStrokes((prev) => {
      const next = prev.slice(0, -1);
      redraw(next);
      return next;
    });
  }

  function clear() {
    setStrokes([]);
    redraw([]);
  }

  useImperativeHandle(ref, () => ({
    isEmpty: () => strokes.length === 0,
    exportPng: () =>
      new Promise<File>((resolve, reject) => {
        const canvas = canvasRef.current;
        if (!canvas) return reject(new Error('canvas not mounted'));
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('canvas export failed'));
          resolve(new File([blob], 'drawing.png', { type: 'image/png' }));
        }, 'image/png');
      }),
  }));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setTool('pen')} disabled={locked} style={{ fontWeight: tool === 'pen' ? 700 : 400 }}>
          Pen
        </button>
        <button type="button" onClick={() => setTool('eraser')} disabled={locked} style={{ fontWeight: tool === 'eraser' ? 700 : 400 }}>
          Eraser
        </button>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setColor(c);
              setTool('pen');
            }}
            disabled={locked}
            aria-label={`color ${c}`}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: c,
              border: color === c && tool === 'pen' ? '2px solid #333' : '1px solid #ccc',
              cursor: locked ? 'default' : 'pointer',
              padding: 0,
            }}
          />
        ))}
        <button type="button" onClick={undo} disabled={locked || strokes.length === 0}>
          Undo
        </button>
        <button type="button" onClick={clear} disabled={locked || strokes.length === 0}>
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={finishStroke}
        style={{
          width: '100%',
          maxWidth: CANVAS_WIDTH,
          height: 'auto',
          aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
          border: '1px solid #ccc',
          borderRadius: 6,
          touchAction: 'none', // required so Apple Pencil / touch strokes don't scroll the page
          cursor: locked ? 'default' : 'crosshair',
        }}
      />
    </div>
  );
});
