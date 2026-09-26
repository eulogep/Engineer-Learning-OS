// Test: first create a speaking session, then correct it
export {};
const BASE = "http://localhost:3000";

async function test() {
  // 1. Create a mock speaking session
  const sessionRes = await fetch(`${BASE}/api/speaking-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // We can't send real audio, so we'll create the session directly
      // Actually, let's just test the correction with a sessionId
    }),
  });
  // This will fail without audio — let's test correction directly without sessionId first
  console.log("=== Test 1: Correction without sessionId ===");
  const res1 = await fetch(`${BASE}/api/correction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcription:
        "I want to embrace new challenges. Sometime we have to overcome difficult situation.",
      words: [{ id: "w1", word: "embrace" }, { id: "w2", word: "overcome" }],
      personalSentences: {
        w1: "I try to embrace new challenges at work every day.",
      },
    }),
  });
  const data1 = await res1.json();
  console.log("Status:", res1.status);
  console.log("Corrected:", data1.correctedText?.substring(0, 80) + "...");
  console.log("Errors:", data1.feedback?.errors?.length);

  // 2. Test with a fake sessionId (should not crash)
  console.log("\n=== Test 2: Correction with fake sessionId ===");
  const res2 = await fetch(`${BASE}/api/correction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcription: "A genuine smile can change someone day.",
      sessionId: "fake-id",
      words: [{ id: "w1", word: "genuine" }],
      personalSentences: {},
    }),
  });
  const data2 = await res2.json();
  console.log("Status:", res2.status);
  console.log("Corrected:", data2.correctedText);
  // The DB update in finally should fail silently for fake-id
  console.log("Done — DB update for fake-id should have failed silently.");
}

test().catch(console.error);