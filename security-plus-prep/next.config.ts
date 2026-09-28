import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdf-parse does dynamic requires that webpack's RSC bundling can't
  // handle ("Object.defineProperty called on non-object" at request time,
  // even though `next build` succeeds since the route is dynamic). Keep it
  // as a real Node require instead of bundling it.
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
