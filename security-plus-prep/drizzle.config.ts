import { defineConfig } from 'drizzle-kit';

// drizzle-kit (generate/migrate/push/studio) always connects over plain
// node-postgres, and specifically over DIRECT_URL — Neon's pooled
// (DATABASE_URL, "-pooler") endpoint doesn't support the session-level
// advisory locks drizzle-kit's migrator takes, which made `db:migrate`
// hang indefinitely and apply nothing. The app itself is unaffected: it
// keeps using @neondatabase/serverless over DATABASE_URL at runtime
// (see src/db/index.ts) — this file only governs the CLI.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
});
