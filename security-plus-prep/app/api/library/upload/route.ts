import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getActiveCertificationId } from '@/lib/active-certification';

// Token-issuing endpoint for the Library's client-side direct-to-Blob PDF
// upload (see src/components/library/UploadPdfForm.tsx). The actual file
// bytes go straight from the browser to Blob storage — never through this
// server, and never through a Server Action body — which is what makes a
// large PDF (previously ~10MB would hang forever against Next.js's 1MB
// default Server Action body limit) work at all.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // The client constructs pathname as `library/{certificationId}/...`
        // itself (it already has this from the /library page render), but
        // the token is only ever issued for the REAL active certification
        // resolved server-side from the session — a client can't get a
        // token to write into a certification it didn't actually select.
        const certificationId = await getActiveCertificationId();
        if (!pathname.startsWith(`library/${certificationId}/`)) {
          throw new Error('Upload path does not match the active certification.');
        }
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 50 * 1024 * 1024,
        };
      },
      // No onUploadCompleted work needed — the client explicitly calls
      // ingestUploadedPdf() itself once upload() resolves, which is what
      // drives the "Processing..." UI phase. This webhook also doesn't
      // fire at all on localhost without a public tunnel, so relying on
      // it for the main flow would make local dev silently incomplete.
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
