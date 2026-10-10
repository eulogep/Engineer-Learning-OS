import { db } from "@/lib/db";
import { VOCABULARY } from "@/modules/daily-english/vocabulary";

// Single source of truth shared with the browser-only mode.
const SEED_WORDS = VOCABULARY;

async function seed() {
  console.log("Seeding words...");

  for (const w of SEED_WORDS) {
    await db.word.upsert({
      where: { id: `seed-${w.word.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `seed-${w.word.toLowerCase().replace(/\s+/g, "-")}`,
        word: w.word,
        translation: w.translation,
        category: w.category,
        status: "nouveau",
      },
    });
  }

  const count = await db.word.count();
  console.log(`Done. ${count} words in database.`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });