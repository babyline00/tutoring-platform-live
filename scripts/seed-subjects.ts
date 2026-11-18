/**
 * Seed the Subject catalog with the 6 hardcoded subjects.
 *
 * Usage (with isolated DB):
 *   bun run scripts/seed-subjects.ts
 *
 * The DATABASE_URL env var must point at this project's own SQLite file
 * (see .env / .env.example). The runner upserts so it is safe to re-run.
 */

import { PrismaClient } from "@prisma/client";
import {
  SUBJECT_SEEDS,
  validateAllSeeds,
  subjectSeedToCreateData,
} from "../src/lib/seed-helpers";

async function main() {
  const errors = validateAllSeeds(SUBJECT_SEEDS);
  if (errors.length) {
    console.error("[seed] validation failed:\n" + errors.join("\n"));
    process.exit(1);
  }

  const db = new PrismaClient();
  try {
    let count = 0;
    for (const seed of SUBJECT_SEEDS) {
      await db.subject.upsert({
        where: { name: seed.name },
        create: subjectSeedToCreateData(seed),
        update: subjectSeedToCreateData(seed),
      });
      count++;
      console.log(`[seed] upserted subject "${seed.name}" (${seed.label}) with ${seed.topics.length} topics`);
    }
    console.log(`[seed] done — ${count} subjects seeded.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("[seed] fatal:", e);
  process.exit(1);
});
