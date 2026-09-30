import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getActiveCertificationId } from '@/lib/active-certification';

// Token-issuing endpoint for topic notes' client-side direct-to-Blob image
// upload (see src/components/topics/TopicImages.tsx) — mirrors
// app/api/library/upload/route.ts's pattern exactly: the resized image
// bytes go straight from the browser to Blob storage, never through a
// Server Action body. Cert-scoped path only (not user-scoped), same
// reasoning as the library route: this app has one user, and the DB row
// (topic_images.user_id) is what actually scopes ownership on read/delete.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const certificationId = await getActiveCertificationId();
        if (!pathname.startsWith(`topics/${certificationId}/`)) {
          throw new Error('Upload path does not match the active certification.');
        }
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          maximumSizeInBytes: 10 * 1024 * 1024,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
