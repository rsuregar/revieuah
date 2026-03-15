/**
 * Tests for update-prompt: LABELS i18n.
 * showUpdatePrompt is not unit-tested here (it opens a real TUI); test manually in a terminal.
 * Run: node --test dist/ui/update-prompt.test.js (after yarn build)
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { UPDATE_PROMPT_LABELS } from "./update-prompt.js";

describe("UPDATE_PROMPT_LABELS", () => {
  it("has en and id with required keys", () => {
    for (const lang of ["en", "id"] as const) {
      const labels = UPDATE_PROMPT_LABELS[lang];
      assert.ok(labels.title);
      assert.ok(labels.newVersion);
      assert.ok(labels.current);
      assert.ok(labels.whatsNew);
      assert.ok(labels.update);
      assert.ok(labels.skip);
      assert.ok(labels.hint);
    }
  });

  it("Indonesian labels are different from English", () => {
    assert.notStrictEqual(UPDATE_PROMPT_LABELS.id.newVersion, UPDATE_PROMPT_LABELS.en.newVersion);
    assert.strictEqual(UPDATE_PROMPT_LABELS.id.newVersion, "Versi baru tersedia:");
    assert.strictEqual(UPDATE_PROMPT_LABELS.en.newVersion, "New version available:");
    assert.strictEqual(UPDATE_PROMPT_LABELS.id.skip, " Lewati ");
    assert.strictEqual(UPDATE_PROMPT_LABELS.en.skip, " Skip ");
  });

  it("id hint contains Pilih and Konfirmasi", () => {
    assert.ok(UPDATE_PROMPT_LABELS.id.hint.includes("Pilih"));
    assert.ok(UPDATE_PROMPT_LABELS.id.hint.includes("Konfirmasi"));
  });

  it("en hint contains Select and Confirm", () => {
    assert.ok(UPDATE_PROMPT_LABELS.en.hint.includes("Select"));
    assert.ok(UPDATE_PROMPT_LABELS.en.hint.includes("Confirm"));
  });
});
