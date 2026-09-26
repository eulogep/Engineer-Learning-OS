import assert from "node:assert/strict";
import { after, test } from "node:test";

import { createBrowserHarness } from "./browser-driver.mjs";

const browser = await createBrowserHarness({});
after(() => browser.close());
console.log("REAL_BROWSER_RECOVERY", browser.version.product);

test("real Chrome restores canonical history into a distinct fresh database and reopens it", async () => {
  const result = await browser.call(browser.mainTab, "recoveryRoundTrip", 3, true);
  assert.equal(result.imported, "IMPORTED"); assert.equal(result.idempotent, "IDEMPOTENT");
  assert.equal(result.sourceEvents, 6); assert.equal(result.targetEvents, 6);
  assert.equal(result.sourceJobs, 3); assert.equal(result.targetJobs, 3);
  assert.equal(result.sourceDigest, result.targetDigest);
  assert.equal(result.projectionsEqual, true);
  assert.equal(result.sourceUnchanged, true); assert.equal(result.targetNameDifferent, true);
  assert.equal(result.deletionProtected, true);
  assert.deepEqual(result.classifications, { SYNC_ALLOWED: 3, LOCAL_ONLY: 2, UNKNOWN_BLOCKED: 1 });
  assert.equal(result.referenceCount, 1); assert.equal(result.referencesRequireRelink, true);
  assert.equal(result.containsForbiddenRaw, false);
});

for (const count of [1000, 10000]) {
  test("real Chrome round-trips " + count + " canonical event/outbox pairs", async () => {
    const result = await browser.call(browser.mainTab, "recoveryRoundTrip", count, false);
    console.log("RECOVERY_SCALE_" + count, JSON.stringify(result));
    assert.equal(result.sourceEvents, count); assert.equal(result.targetEvents, count);
    assert.equal(result.sourceJobs, count); assert.equal(result.targetJobs, count);
    assert.equal(result.sourceDigest, result.targetDigest); assert.equal(result.sourceUnchanged, true);
    assert.equal(result.projectionsEqual, true);
    assert.equal(result.containsForbiddenRaw, false);
  });
}
