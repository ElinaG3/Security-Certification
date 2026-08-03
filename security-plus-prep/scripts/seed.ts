import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import seedQuestions from './seed-questions.json' with { type: 'json' };
import type { MultipleChoiceContent } from '../src/db/question-types';

const client = neon(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

async function main() {
  const email = process.env.SEED_USER_EMAIL;
  if (!email) throw new Error('Set SEED_USER_EMAIL in .env.local before seeding.');

  let [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user) {
    [user] = await db.insert(schema.users).values({ email }).returning();
    console.log(`Created user ${user.email}`);
  } else {
    console.log(`Using existing user ${user.email}`);
  }

  const [{ count }] = await db
    .select({ count: sql`count(*)::int` })
    .from(schema.cards)
    .where(and(eq(schema.cards.userId, user.id), eq(schema.cards.sourceType, 'manual-seed')));

  if (Number(count) > 0) {
    console.log(`${count} manual-seed cards already exist for this user — skipping insert.`);
    return;
  }

  type LegacyQuestion = {
    id: number;
    domain: string;
    topic: string;
    question: string;
    options: string[];
    correct: number;
    explanation: string;
  };

  const rows = (seedQuestions as LegacyQuestion[]).map((q) => {
    const content: MultipleChoiceContent = {
      question: q.question,
      options: q.options,
      correct: q.correct,
      explanation: q.explanation,
    };
    return {
      userId: user.id,
      domain: q.domain,
      topic: q.topic,
      type: 'multiple_choice' as const,
      content,
      status: 'active' as const,
      sourceType: 'manual-seed',
      sourceRef: `legacy-question:${q.id}`,
    };
  });

  await db.insert(schema.cards).values(rows);
  console.log(`Inserted ${rows.length} cards.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
