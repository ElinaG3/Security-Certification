import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';

// Thin wrapper so callers never touch @vercel/blob directly — one place to
// change storage backends later, and one place that enforces the path
// convention (userId-scoped, random filename so URLs aren't guessable).
export async function uploadRecallImage(userId: string, file: File, kind: 'drawing' | 'upload'): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'bin';
  const path = `recall/${userId}/${kind}-${randomUUID()}.${ext}`;
  const blob = await put(path, file, { access: 'public' });
  return blob.url;
}
