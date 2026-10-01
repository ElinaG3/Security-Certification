// Browser-only (canvas/Image) — only ever imported from a 'use client'
// component. Resizes to at most MAX_DIMENSION on the longest side and
// re-encodes as JPEG (WebP source stays WebP) at ~0.85 quality, so a phone
// camera photo (often 10+ MB) uploads as a small, fast file instead of the
// original.
const MAX_DIMENSION = 1600;
const QUALITY = 0.85;

export async function resizeImageFile(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file; // canvas unsupported — fall back to the original file rather than fail the upload

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const outputType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, QUALITY));
  if (!blob) return file;

  const ext = outputType === 'image/webp' ? 'webp' : 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.${ext}`, { type: outputType });
}
