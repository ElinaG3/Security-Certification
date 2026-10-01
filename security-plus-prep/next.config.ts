import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdf-parse (and pdfjs-dist underneath it) do dynamic requires that
  // webpack's RSC bundling can't handle ("Object.defineProperty called on
  // non-object" at request time, even though `next build` succeeds since
  // the route is dynamic). Keep both as real Node requires instead of
  // bundling them.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  // pdfjs-dist's Node "fake worker" setup requires its own worker file by
  // a path relative to its own package location — output file tracing
  // (Vercel's serverless bundler) can't see that dynamic require
  // statically, so it gets silently excluded from the deployed function
  // ("Cannot find module '.../pdfjs-dist/legacy/build/pdf.worker.mjs'" —
  // found by actually ingesting a real, larger PDF in production; a small
  // 12-page test PDF never hit this code path locally). Force it in.
  outputFileTracingIncludes: {
    '/library': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
};

export default nextConfig;
