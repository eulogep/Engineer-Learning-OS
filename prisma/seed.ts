import { db } from "@/lib/db";

const SEED_WORDS = [
  { word: "embrace", translation: "accepter / serrer", category: "verbe" },
  { word: "resilient", translation: "résilient", category: "adjectif" },
  { word: "perspective", translation: "perspective / point de vue", category: "nom" },
  { word: "overcome", translation: "surmonter", category: "verbe" },
  { word: "genuine", translation: "authentique / sincère", category: "adjectif" },
  { word: "thrive", translation: "s'épanouir / prospérer", category: "verbe" },
  { word: "subtle", translation: "subtil", category: "adjectif" },
  { word: "acknowledge", translation: "reconnaître / admettre", category: "verbe" },
  { word: "meaningful", translation: "significatif / plein de sens", category: "adjectif" },
  { word: "approach", translation: "approche / aborder", category: "verbe" },
  { word: "reflection", translation: "réflexion / reflet", category: "nom" },
  { word: "collaborate", translation: "collaborer", category: "verbe" },
  { word: "challenge", translation: "défi / mettre au défi", category: "nom" },
  { word: "inspire", translation: "inspirer", category: "verbe" },
  { word: "curiosity", translation: "curiosité", category: "nom" },
  { word: "adapt", translation: "s'adapter", category: "verbe" },
  { word: "empathy", translation: "empathie", category: "nom" },
  { word: "progress", translation: "progrès / progresser", category: "nom" },
  { word: "accomplish", translation: "accomplir / réaliser", category: "verbe" },
  { word: "insight", translation: "perspicacité / aperçu", category: "nom" },
  { word: "determination", translation: "détermination", category: "nom" },
  { word: "gratitude", translation: "gratitude / reconnaissance", category: "nom" },
  { word: "influence", translation: "influence / influencer", category: "nom" },
  { word: "explore", translation: "explorer", category: "verbe" },
  { word: "significant", translation: "significatif / important", category: "adjectif" },
  { word: "struggle", translation: "lutte / lutter", category: "verbe" },
  { word: "transform", translation: "transformer", category: "verbe" },
  { word: "opportunity", translation: "opportunité", category: "nom" },
  { word: "contribute", translation: "contribuer", category: "verbe" },
  { word: "intention", translation: "intention", category: "nom" },
];

async function seed() {
  console.log("Seeding words...");

  for (const w of SEED_WORDS) {
    await db.word.upsert({
      where: { id: `seed-${w.word}` },
      update: {},
      create: {
        id: `seed-${w.word}`,
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