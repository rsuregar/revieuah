/**
 * Tests for check-update: getNewerVersions, CI skip, TTY branches, i18n.
 * Run: node --test dist/lib/check-update.test.js (after yarn build)
 */
import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { getNewerVersions, checkForUpdates } from "./check-update.js";

describe("getNewerVersions", () => {
  it("returns only versions greater than current, sorted newest first", () => {
    const time: Record<string, string> = {
      "1.0.0": "2026-01-01",
      "1.0.1": "2026-01-02",
      "1.0.2": "2026-01-03",
      "1.0.3": "2026-01-04",
      created: "2025-01-01",
      modified: "2026-01-04",
    };
    const result = getNewerVersions("1.0.0", time);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0]!.version, "1.0.3");
    assert.strictEqual(result[1]!.version, "1.0.2");
    assert.strictEqual(result[2]!.version, "1.0.1");
    assert.strictEqual(result[0]!.date, "2026-01-04");
  });

  it("excludes created and modified keys", () => {
    const time: Record<string, string> = {
      created: "2025-01-01",
      modified: "2026-01-01",
      "1.0.1": "2026-01-01",
    };
    const result = getNewerVersions("1.0.0", time);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]!.version, "1.0.1");
  });

  it("returns at most 5 versions", () => {
    const time: Record<string, string> = {
      "1.0.1": "2026-01-01",
      "1.0.2": "2026-01-02",
      "1.0.3": "2026-01-03",
      "1.0.4": "2026-01-04",
      "1.0.5": "2026-01-05",
      "1.0.6": "2026-01-06",
    };
    const result = getNewerVersions("1.0.0", time);
    assert.strictEqual(result.length, 5);
    assert.strictEqual(result[0]!.version, "1.0.6");
  });

  it("returns empty when no versions are greater than current", () => {
    const time: Record<string, string> = {
      "1.0.0": "2026-01-01",
      "1.0.1": "2026-01-02",
    };
    const result = getNewerVersions("1.0.2", time);
    assert.strictEqual(result.length, 0);
  });

  it("ignores invalid semver keys", () => {
    const time: Record<string, string> = {
      "1.0.1": "2026-01-01",
      "1.0.2": "2026-01-02",
      "not-a-version": "2026-01-03",
      "x.y.z": "2026-01-04",
    };
    const result = getNewerVersions("1.0.0", time);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0]!.version, "1.0.2");
    assert.strictEqual(result[1]!.version, "1.0.1");
  });
});

describe("checkForUpdates", () => {
  const origEnv = { ...process.env };
  const origStdin = process.stdin.isTTY;
  const origStderr = process.stderr.isTTY;
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...origEnv };
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    Object.defineProperty(process.stderr, "isTTY", { value: false, configurable: true });
  });

  afterEach(() => {
    process.env = origEnv;
    Object.defineProperty(process.stdin, "isTTY", { value: origStdin, configurable: true });
    Object.defineProperty(process.stderr, "isTTY", { value: origStderr, configurable: true });
    globalThis.fetch = origFetch;
  });

  it("skips when CI is set", async () => {
    process.env.CI = "true";
    const fetchMock = mock.fn(() => Promise.resolve({ ok: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await checkForUpdates();

    assert.strictEqual(fetchMock.mock.calls.length, 0);
  });

  it("skips when GITHUB_ACTIONS is set", async () => {
    process.env.GITHUB_ACTIONS = "true";
    const fetchMock = mock.fn(() => Promise.resolve({ ok: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await checkForUpdates();

    assert.strictEqual(fetchMock.mock.calls.length, 0);
  });

  it("does not prompt when no new version (non-TTY)", async () => {
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            "dist-tags": { latest: "1.0.0" },
            time: { "1.0.0": "2026-01-01" },
          }),
      })) as unknown as typeof fetch;

    const consoleSpy = mock.method(console, "error", () => {});

    await checkForUpdates();

    assert.strictEqual(consoleSpy.mock.calls.length, 0);
    consoleSpy.mock.restore();
  });

  it("prints manual update message when new version and non-TTY", async () => {
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            "dist-tags": { latest: "2.0.0" },
            time: { "1.0.0": "2026-01-01", "2.0.0": "2026-02-01" },
          }),
      })) as unknown as typeof fetch;

    const consoleSpy = mock.method(console, "error", () => {});

    await checkForUpdates();

    assert.ok(consoleSpy.mock.calls.length >= 1);
    const out = (consoleSpy.mock.calls.map((c) => c.arguments[0]) as string[]).join(" ");
    assert.ok(out.includes("2.0.0") || out.includes("Update") || out.includes("npm install"));
    consoleSpy.mock.restore();
  });
});
