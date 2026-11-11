/** Run: node --test dist/fix/fix-support.test.js (after yarn build) */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { parseReviewInput } from "./findings.js";
import { getPathsWithWorktreeChanges } from "./git-state.js";
import { resolveRepoFile } from "./safe-path.js";
import {
  parsePatchDecision,
  parseVerifyChoice,
  renderPatchDiff,
} from "../ui/confirm-patch.js";

describe("resolveRepoFile", () => {
  it("accepts a file inside the root and rejects escapes", async () => {
    const root = await mkdtemp(join(tmpdir(), "reviuah-root-"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "a.ts"), "x");

    assert.strictEqual(await resolveRepoFile(root, "src/a.ts"), join(root, "src", "a.ts"));
    await assert.rejects(resolveRepoFile(root, "../etc/passwd"), /outside the repository/);
    await assert.rejects(resolveRepoFile(root, "/etc/passwd"), /absolute path/);
  });

  it("rejects a symlink that points outside the root", async () => {
    const root = await mkdtemp(join(tmpdir(), "reviuah-root-"));
    const outside = await mkdtemp(join(tmpdir(), "reviuah-out-"));
    await writeFile(join(outside, "secret.txt"), "s");
    await symlink(join(outside, "secret.txt"), join(root, "link.txt"));

    await assert.rejects(resolveRepoFile(root, "link.txt"), /symlink/);
  });
});

describe("parseReviewInput", () => {
  it("keeps actionable comments, drops praise and invalid entries, normalises path", () => {
    const comments = parseReviewInput({
      comments: [
        { path: "./src/a.ts", line: 3.9, body: " fix ", severity: "critical" },
        { path: "src/b.ts", line: 1, body: "nice", severity: "praise" },
        { path: "src/c.ts", body: "" },
        { body: "no path" },
        { path: "src/d.ts", body: "unknown severity", severity: "constructor" },
      ],
    });
    assert.deepStrictEqual(comments, [
      { path: "src/a.ts", line: 3, body: "fix", severity: "critical" },
      { path: "src/d.ts", line: 0, body: "unknown severity", severity: "warning" },
    ]);
  });

  it("rejects JSON that is not a per-file review", () => {
    assert.throws(() => parseReviewInput({ summary: "x" }), /missing "comments"/);
  });
});

describe("getPathsWithWorktreeChanges", () => {
  it("flags unstaged and untracked files but not clean or fully staged ones", async () => {
    const root = await mkdtemp(join(tmpdir(), "reviuah-git-"));
    const git = (...args: string[]) => execa("git", args, { cwd: root });
    await git("init", "-q");
    await git("config", "user.email", "t@example.com");
    await git("config", "user.name", "t");
    for (const name of ["clean", "unstaged", "staged"]) {
      await writeFile(join(root, name), "v1\n");
    }
    await git("add", ".");
    await git("commit", "-qm", "init");

    await writeFile(join(root, "unstaged"), "v2\n");
    await writeFile(join(root, "staged"), "v2\n");
    await git("add", "staged");
    await writeFile(join(root, "untracked"), "x\n");

    const dirty = await getPathsWithWorktreeChanges(root, [
      "clean",
      "unstaged",
      "staged",
      "untracked",
    ]);
    assert.deepStrictEqual([...dirty].sort(), ["unstaged", "untracked"]);
  });
});

describe("confirm-patch helpers", () => {
  it("defaults to the safe choice on unknown input", () => {
    assert.strictEqual(parsePatchDecision(""), "no");
    assert.strictEqual(parsePatchDecision("maybe"), "no");
    assert.strictEqual(parsePatchDecision(" A "), "all");
    assert.strictEqual(parseVerifyChoice(""), "rollback");
    assert.strictEqual(parseVerifyChoice("T"), "retry");
  });

  it("renders a unified-diff style hunk", () => {
    assert.strictEqual(
      renderPatchDiff("a.ts", 7, "x\ny", "z"),
      ["--- a/a.ts", "+++ b/a.ts", "@@ -7,2 +7,1 @@", "-x", "-y", "+z"].join("\n"),
    );
  });

  it("does not render a trailing newline as an extra empty line", () => {
    assert.strictEqual(
      renderPatchDiff("a.ts", 1, "x\n", "y\n"),
      ["--- a/a.ts", "+++ b/a.ts", "@@ -1,1 +1,1 @@", "-x", "+y"].join("\n"),
    );
  });

  it("leaves out lines shared by the search and replace blocks", () => {
    assert.strictEqual(
      renderPatchDiff("a.ts", 10, "keep1\nold\nkeep2", "keep1\nnew1\nnew2\nkeep2"),
      ["--- a/a.ts", "+++ b/a.ts", "@@ -11,1 +11,2 @@", "-old", "+new1", "+new2"].join("\n"),
    );
  });

  it("renders a pure insertion and a pure deletion without phantom lines", () => {
    assert.strictEqual(
      renderPatchDiff("a.ts", 3, "a\nb", "a\nx\nb"),
      ["--- a/a.ts", "+++ b/a.ts", "@@ -4,0 +4,1 @@", "+x"].join("\n"),
    );
    assert.strictEqual(
      renderPatchDiff("a.ts", 3, "a\nx\nb", "a\nb"),
      ["--- a/a.ts", "+++ b/a.ts", "@@ -4,1 +4,0 @@", "-x"].join("\n"),
    );
  });
});
