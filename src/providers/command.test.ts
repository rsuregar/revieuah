/** Run: node --test dist/providers/command.test.js (after yarn build) */
import { describe, it } from "node:test";
import assert from "node:assert";
import { CommandProvider } from "./command.js";

const request = { diff: "DIFF-MARKER", language: "en" };

describe("CommandProvider", () => {
  it("sends the prompt on stdin and reads the answer from stdout", async () => {
    const markdown = (await new CommandProvider("cat").review(request)).markdown;
    assert.ok(markdown.includes("Git diff:"));
    assert.ok(markdown.includes("DIFF-MARKER"));
  });

  it("extracts the risk level from the markdown answer", async () => {
    const provider = new CommandProvider("printf '## Risk Level\\nHigh\\n'");
    assert.strictEqual((await provider.review(request)).risk, "high");
  });

  it("parses a JSON per-file answer", async () => {
    const provider = new CommandProvider(
      `printf '{"summary":"ok","risk":"low","comments":[]}'`,
    );
    const result = await provider.reviewPerFile(request);
    assert.strictEqual(result.summary, "ok");
    assert.deepStrictEqual(result.comments, []);
  });

  it("reports a non-zero exit with the command's stderr", async () => {
    const provider = new CommandProvider("echo boom >&2; exit 3");
    await assert.rejects(provider.review(request), /exit 3.*boom/);
  });

  it("rejects empty output", async () => {
    await assert.rejects(new CommandProvider("true").review(request), /no output/);
  });

  it("times out a command that never answers", async () => {
    const previous = process.env.REVIUAH_REQUEST_TIMEOUT_MS;
    process.env.REVIUAH_REQUEST_TIMEOUT_MS = "200";
    try {
      await assert.rejects(new CommandProvider("sleep 5").review(request), /timed out/);
    } finally {
      if (previous === undefined) delete process.env.REVIUAH_REQUEST_TIMEOUT_MS;
      else process.env.REVIUAH_REQUEST_TIMEOUT_MS = previous;
    }
  });
});
