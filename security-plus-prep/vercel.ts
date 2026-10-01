import type { VercelConfig } from '@vercel/config/v1';

// The Vercel project's stored settings still say framework: "vite",
// outputDirectory: "dist" from before this app migrated off Vite/React to
// Next.js — that stale setting made every deploy skip Next's serverless
// function output entirely (dynamic routes 404'd). Declaring the framework
// here overrides the dashboard setting.
export const config: VercelConfig = {
  framework: 'nextjs',
  outputDirectory: null,
};
