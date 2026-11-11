/** Run: node --test dist/fix/patch-applier.test.js (after yarn build) */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySearchReplace, FileSnapshots } from "./patch-applier.js";

describe("applySearchReplace", () => {
  it("replaces a unique match and reports its 1-based start line", () => {
    const content = "a\nb\nconst x = 1;\nc\n";
    const result = applySearchReplace(content, {
      search: "const x = 1;",
      replace: "const x = 2;",
    });
    assert.deepStrictEqual(result, {
      ok: true,
      content: "a\nb\nconst x = 2;\nc\n",
      startLine: 3,
    });
  });

  it("refuses when the search text is missing", () => {
    const result = applySearchReplace("abc", { search: "xyz", replace: "q" });
    assert.deepStrictEqual(result, { ok: false, reason: "not-found" });
  });

  it("refuses when the search text matches more than once", () => {
    const result = applySearchReplace("foo\nfoo\n", {
      search: "foo",
      replace: "bar",
    });
    assert.deepStrictEqual(result, { ok: false, reason: "ambiguous" });
  });

  it("treats whitespace differences as no match", () => {
    const result = applySearchReplace("  if (a) {}", {
      search: "if (a) {}\n",
      replace: "",
    });
    assert.strictEqual(result.ok, false);
  });

  it("keeps `$` sequences in the replacement literal", () => {
    const result = applySearchReplace("price = 1", {
      search: "1",
      replace: "`$&${x}$1`",
    });
    assert.ok(result.ok);
    assert.strictEqual(result.content, "price = `$&${x}$1`");
  });
});

describe("FileSnapshots", () => {
  it("restores the first remembered content, ignoring later calls", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reviuah-snap-"));
    const file = join(dir, "a.txt");
    await writeFile(file, "original");

    const snapshots = new FileSnapshots();
    snapshots.remember(file, "original");
    await writeFile(file, "patched once");
    snapshots.remember(file, "patched once");
    await writeFile(file, "patched twice");

    await snapshots.rollback();
    assert.strictEqual(await readFile(file, "utf8"), "original");
    assert.strictEqual(snapshots.size, 0);
  });
});
