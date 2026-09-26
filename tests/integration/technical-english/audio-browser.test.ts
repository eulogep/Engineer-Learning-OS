import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createBrowserHarness } from "../learning-history/browser-driver.mjs";

const browser = await createBrowserHarness({});
after(() => browser.close());
console.log("REAL_BROWSER_AUDIO", browser.version.product);

test("production audio service round-trips and deletes a synthetic Blob in real Chrome IndexedDB", async () => {
  const result = await browser.call(browser.mainTab, "localAudioRoundTrip");
  assert.ok(result.sourceSize > 0);
  assert.equal(result.loadedSize, result.sourceSize);
  assert.equal(result.loadedType, "audio/webm");
  assert.equal(result.durationMs, 1_250);
  assert.equal(result.referenceContainsContent, false);
  assert.equal(result.countBeforeDelete, 1);
  assert.equal(result.countAfterDelete, 0);
});
