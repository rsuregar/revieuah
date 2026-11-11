/** Run: node --test dist/fix/gitlab-discussions.test.js (after yarn build) */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import {
  discussionsToComments,
  fetchDiscussions,
  fetchMrHeadSha,
  isCommitInHead,
  parseGitLabRemote,
  type GitLabDiscussion,
} from "./gitlab-discussions.js";
import { assertSingleSource, parseGitLabToken, parseMrIid } from "./load-findings.js";

describe("parseGitLabRemote", () => {
  it("parses https, ssh://, and scp-like remotes", () => {
    const expected = { baseUrl: "https://gitlab.com", projectPath: "group/sub/app" };
    assert.deepStrictEqual(parseGitLabRemote("https://gitlab.com/group/sub/app.git"), expected);
    assert.deepStrictEqual(parseGitLabRemote("git@gitlab.com:group/sub/app.git"), expected);
    assert.deepStrictEqual(parseGitLabRemote("ssh://git@gitlab.com:2222/group/sub/app.git"), expected);
    assert.deepStrictEqual(parseGitLabRemote("https://gitlab.com/group/sub/app/"), expected);
  });

  it("keeps host and port of a self-hosted https remote", () => {
    assert.deepStrictEqual(parseGitLabRemote("https://git.example.com:8443/team/app.git"), {
      baseUrl: "https://git.example.com:8443",
      projectPath: "team/app",
    });
  });

  it("rejects remotes without a group/project path", () => {
    assert.throws(() => parseGitLabRemote("https://gitlab.com/app.git"), /group\/project/);
    assert.throws(() => parseGitLabRemote("not a url"), /Cannot parse/);
  });
});

const diffNote = (over: Record<string, unknown> = {}) => ({
  type: "DiffNote",
  body: "use optional chaining",
  system: false,
  resolvable: true,
  resolved: false,
  author: { username: "reviewer-a" },
  position: { new_path: "src/a.ts", new_line: 12 },
  ...over,
});

describe("discussionsToComments", () => {
  it("keeps only unresolved diff threads and joins every note with its author", () => {
    const discussions: GitLabDiscussion[] = [
      { notes: [diffNote(), diffNote({ body: "fine to ignore", author: { username: "reviewer-b" } })] },
      { notes: [diffNote({ resolved: true })] },
      { notes: [diffNote({ system: true })] },
      { notes: [diffNote({ type: "DiscussionNote" })] },
      { notes: [diffNote({ type: null, resolvable: false })], individual_note: true },
    ];
    const { comments, unmappable } = discussionsToComments(discussions);
    assert.deepStrictEqual(comments, [
      {
        path: "src/a.ts",
        line: 12,
        severity: "suggestion",
        body: "reviewer-a: use optional chaining\n\nreviewer-b: fine to ignore",
      },
    ]);
    assert.strictEqual(unmappable, 0);
  });

  it("counts threads on removed lines instead of guessing a position", () => {
    const { comments, unmappable } = discussionsToComments([
      { notes: [diffNote({ position: { new_path: "src/a.ts", new_line: null } })] },
    ]);
    assert.deepStrictEqual(comments, []);
    assert.strictEqual(unmappable, 1);
  });

  it("leaves out system notes inside a thread", () => {
    const { comments } = discussionsToComments([
      { notes: [diffNote(), diffNote({ system: true, body: "changed this line" })] },
    ]);
    assert.strictEqual(comments[0]!.body, "reviewer-a: use optional chaining");
  });
});

function fakeFetch(pages: unknown[][], status = 200) {
  const urls: string[] = [];
  const tokens: Array<string | undefined> = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    urls.push(String(input));
    tokens.push((init?.headers as Record<string, string>)["PRIVATE-TOKEN"]);
    const page = urls.length;
    return new Response(JSON.stringify(pages[page - 1] ?? []), {
      status,
      headers: page < pages.length ? { "x-next-page": String(page + 1) } : {},
    });
  }) as typeof fetch;
  return { fn, urls, tokens };
}

describe("fetchDiscussions", () => {
  const project = { baseUrl: "https://gitlab.com", projectPath: "group/sub/app" };

  it("follows pagination, encodes the project path, and sends the token header", async () => {
    const { fn, urls, tokens } = fakeFetch([[{ id: 1 }], [{ id: 2 }]]);
    const result = await fetchDiscussions(project, 1237, "tok", fn);
    assert.strictEqual(result.length, 2);
    assert.ok(urls[0]!.startsWith("https://gitlab.com/api/v4/projects/group%2Fsub%2Fapp/merge_requests/1237/discussions"));
    assert.deepStrictEqual(tokens, ["tok", "tok"]);
  });

  it("explains auth and not-found failures without leaking the token", async () => {
    await assert.rejects(fetchDiscussions(project, 1, "secret", fakeFetch([], 401).fn), /read_api/);
    const err = await fetchDiscussions(project, 1, "secret", fakeFetch([], 404).fn).catch((e: Error) => e);
    assert.match((err as Error).message, /not found/);
    assert.ok(!(err as Error).message.includes("secret"));
  });
});

describe("fetchMrHeadSha", () => {
  const project = { baseUrl: "https://gitlab.com", projectPath: "group/sub/app" };
  const respondWith = (body: unknown, status = 200) =>
    (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

  it("returns the MR source-branch head sha", async () => {
    assert.strictEqual(await fetchMrHeadSha(project, 1, "tok", respondWith({ sha: "abc123" })), "abc123");
  });

  it("returns undefined when the response has no usable sha", async () => {
    assert.strictEqual(await fetchMrHeadSha(project, 1, "tok", respondWith({ sha: null })), undefined);
    assert.strictEqual(await fetchMrHeadSha(project, 1, "tok", respondWith({})), undefined);
  });

  it("explains HTTP failures", async () => {
    await assert.rejects(fetchMrHeadSha(project, 1, "tok", respondWith({}, 404)), /not found/);
  });
});

describe("isCommitInHead", () => {
  it("is true for HEAD and its ancestors, false for unknown or unrelated commits", async () => {
    const root = await mkdtemp(join(tmpdir(), "reviuah-git-"));
    const git = (...args: string[]) => execa("git", args, { cwd: root });
    const commit = (message: string) =>
      git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", message);
    await git("init", "-q", "-b", "main");
    await commit("first");
    const first = (await git("rev-parse", "HEAD")).stdout;
    await commit("second");
    const second = (await git("rev-parse", "HEAD")).stdout;
    await git("switch", "-q", "-c", "other", first);
    await commit("side");
    const side = (await git("rev-parse", "HEAD")).stdout;

    assert.strictEqual(await isCommitInHead(root, side), true);
    assert.strictEqual(await isCommitInHead(root, first), true);
    assert.strictEqual(await isCommitInHead(root, second), false);
    assert.strictEqual(await isCommitInHead(root, "0".repeat(40)), false);
  });
});

describe("--mr / --input validation", () => {
  it("accepts only positive integers for --mr", () => {
    assert.strictEqual(parseMrIid("1237"), 1237);
    for (const bad of ["0", "-1", "12a", "../x", "1.5", ""]) {
      assert.throws(() => parseMrIid(bad), /merge request number/);
    }
  });

  it("requires exactly one source", () => {
    assert.throws(() => assertSingleSource({}), /Missing a source/);
    assert.throws(() => assertSingleSource({ input: "a.json", mr: "1" }), /only one/);
    assert.doesNotThrow(() => assertSingleSource({ mr: "1" }));
  });

  it("rejects a token with embedded newlines without echoing it", () => {
    const polluted = "[theme] loaded\nglpat-SECRET123";
    assert.throws(
      () => parseGitLabToken(polluted),
      (err: Error) => /non-printable/.test(err.message) && !err.message.includes("SECRET123"),
    );
    assert.throws(() => parseGitLabToken("  "), /not set/);
    assert.throws(() => parseGitLabToken(undefined), /not set/);
    assert.strictEqual(parseGitLabToken("  glpat-abc.123_x \n"), "glpat-abc.123_x");
  });
});
