'use client';

import { useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { resizeImageFile } from '@/lib/image-resize';
import { addTopicImage, updateTopicImageCaption, deleteTopicImage, type TopicImageRow } from '@/lib/topic-images';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type UploadState = { kind: 'idle' } | { kind: 'uploading'; percent: number } | { kind: 'error'; message: string };

export function TopicImages({
  objective,
  certificationId,
  initialImages,
}: {
  objective: string;
  certificationId: string;
  initialImages: TopicImageRow[];
}) {
  const [images, setImages] = useState<TopicImageRow[]>(initialImages);
  const [uploadState, setUploadState] = useState<UploadState>({ kind: 'idle' });
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function uploadOne(file: File) {
    if (!file.type.startsWith('image/')) {
      setUploadState({ kind: 'error', message: 'Only image files are accepted.' });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadState({ kind: 'error', message: 'Image is too large (10 MB max before resizing).' });
      return;
    }

    setUploadState({ kind: 'uploading', percent: 0 });
    try {
      const resized = await resizeImageFile(file);
      const ext = resized.type === 'image/webp' ? 'webp' : 'jpg';
      const pathname = `topics/${certificationId}/${objective}/${crypto.randomUUID()}.${ext}`;

      const blob = await upload(pathname, resized, {
        access: 'public',
        handleUploadUrl: '/api/topics/images/upload',
        onUploadProgress: ({ percentage }) => setUploadState({ kind: 'uploading', percent: Math.round(percentage) }),
      });

      const row = await addTopicImage(objective, blob.url);
      setImages((prev) => [row, ...prev]);
      setUploadState({ kind: 'idle' });
    } catch (err) {
      setUploadState({ kind: 'error', message: err instanceof Error ? err.message : 'Upload failed.' });
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadOne(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  // "Paste-from-clipboard (Ctrl+V of a screenshot)" — scoped to this
  // component's own container rather than a page-global listener, so
  // pasting into the notes textarea above (plain text) is unaffected.
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) uploadOne(file);
    }
    const el = containerRef.current;
    el?.addEventListener('paste', handlePaste);
    return () => el?.removeEventListener('paste', handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objective, certificationId]);

  async function handleSaveCaption(id: string) {
    await updateTopicImageCaption(id, captionDraft);
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, caption: captionDraft.trim() || null } : img)));
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this image? This cannot be undone.')) return;
    await deleteTopicImage(id);
    setImages((prev) => prev.filter((img) => img.id !== id));
    if (lightboxId === id) setLightboxId(null);
  }

  const lightboxImage = images.find((img) => img.id === lightboxId) ?? null;

  return (
    <div ref={containerRef} tabIndex={0} style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--card-border)', outline: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Images</h3>
        <label className="btn" style={{ cursor: uploadState.kind === 'uploading' ? 'default' : 'pointer', opacity: uploadState.kind === 'uploading' ? 0.7 : 1, minHeight: 36, padding: '0 12px', fontSize: 13 }}>
          {uploadState.kind === 'uploading' ? `Uploading... ${uploadState.percent}%` : 'Add image'}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploadState.kind === 'uploading'}
            style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}
          />
        </label>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Click here and paste (Ctrl+V) a screenshot, or use Add image for the camera/gallery.
      </p>

      {uploadState.kind === 'error' && <p style={{ fontSize: 13, color: '#c0392b', marginBottom: 12 }}>{uploadState.message}</p>}

      {images.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No images yet.</p>
      ) : (
        <div className="topic-images-grid">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                setLightboxId(img.id);
                setCaptionDraft(img.caption ?? '');
              }}
              style={{ padding: 0, border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: 'none', display: 'block', width: '100%', textAlign: 'left' }}
              aria-label={img.caption ?? 'View image'}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption ?? ''} style={{ width: '100%', height: 'auto', maxHeight: '70vh', objectFit: 'contain', display: 'block' }} />
              {img.caption && <p style={{ margin: 0, padding: '6px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>{img.caption}</p>}
            </button>
          ))}
        </div>
      )}

      {lightboxImage && (
        <div
          role="button"
          tabIndex={-1}
          onClick={() => setLightboxId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxId(null)}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: 24,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>

          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.url}
              alt={lightboxImage.caption ?? ''}
              style={{ maxWidth: '95vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8, touchAction: 'pinch-zoom' }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                placeholder="Add a caption..."
                style={{ flex: '1 1 200px', minHeight: 44, padding: '0 10px', borderRadius: 8, border: '1px solid var(--card-border)' }}
              />
              <button type="button" className="btn" onClick={() => handleSaveCaption(lightboxImage.id)}>
                Save caption
              </button>
              <button type="button" className="btn" onClick={() => handleDelete(lightboxImage.id)} style={{ color: '#c0392b' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
