import { execa } from "execa";
import type { FileComment } from "../providers/index.js";

const MAX_PAGES = 20;
const PER_PAGE = 100;

export interface GitLabProject {
  /** e.g. https://gitlab.com (no trailing slash). */
  baseUrl: string;
  /** e.g. group/subgroup/project */
  projectPath: string;
}

interface GitLabNote {
  type?: string | null;
  body?: string;
  system?: boolean;
  resolvable?: boolean;
  resolved?: boolean;
  author?: { username?: string };
  position?: { new_path?: string; new_line?: number | null };
}

export interface GitLabDiscussion {
  individual_note?: boolean;
  notes?: GitLabNote[];
}

export interface DiscussionConversion {
  comments: FileComment[];
  /** Unresolved diff threads that could not be mapped to a new-file line. */
  unmappable: number;
}

/**
 * Derive the GitLab host and project path from a git remote URL.
 * Supports https/http, ssh://, and scp-like (git@host:group/project.git).
 * SSH remotes use https for the API.
 */
export function parseGitLabRemote(remoteUrl: string): GitLabProject {
  const url = remoteUrl.trim();
  const scp = /^[^@/\s]+@([^:/\s]+):(?!\/)(.+)$/.exec(url);

  let baseUrl: string;
  let rawPath: string;
  if (scp) {
    baseUrl = `https://${scp[1]}`;
    rawPath = scp[2]!;
  } else {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Cannot parse git remote URL: ${remoteUrl}`);
    }
    const isHttp = parsed.protocol === "https:" || parsed.protocol === "http:";
    baseUrl = isHttp ? `${parsed.protocol}//${parsed.host}` : `https://${parsed.hostname}`;
    rawPath = decodeURIComponent(parsed.pathname);
  }

  const projectPath = rawPath.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.git$/, "");
  if (projectPath.split("/").length < 2) {
    throw new Error(
      `Cannot find a "group/project" path in git remote: ${remoteUrl}. Expected e.g. git@gitlab.com:group/project.git`,
    );
  }
  return { baseUrl, projectPath };
}

export async function getOriginUrl(root: string): Promise<string> {
  const result = await execa("git", ["remote", "get-url", "origin"], {
    cwd: root,
    reject: false,
  });
  if (result.exitCode !== 0) {
    throw new Error("No git remote named 'origin'. `--mr` reads the GitLab project from it.");
  }
  return result.stdout.trim();
}

function describeStatus(status: number): string {
  switch (status) {
    case 401: return "GitLab rejected GITLAB_TOKEN (401). Check the token and that it has read_api scope.";
    case 403: return "GitLab denied access (403). The token needs read_api scope on this project.";
    case 404: return "Merge request not found (404). Check the number, and that the token can see this project.";
    default: return `GitLab request failed (${status}).`;
  }
}

/** Fetch every discussion of a merge request, following pagination. */
export async function fetchDiscussions(
  project: GitLabProject,
  mrIid: number,
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<GitLabDiscussion[]> {
  const projectId = encodeURIComponent(project.projectPath);
  const all: GitLabDiscussion[] = [];
  let page = "1";

  for (let i = 0; i < MAX_PAGES && page; i++) {
    const url = `${project.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}/discussions?per_page=${PER_PAGE}&page=${page}`;
    const response = await fetchFn(url, { headers: { "PRIVATE-TOKEN": token } });
    if (!response.ok) throw new Error(describeStatus(response.status));
    all.push(...((await response.json()) as GitLabDiscussion[]));
    page = response.headers.get("x-next-page") ?? "";
  }
  return all;
}

/** Current head commit of the merge request's source branch. */
export async function fetchMrHeadSha(
  project: GitLabProject,
  mrIid: number,
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | undefined> {
  const projectId = encodeURIComponent(project.projectPath);
  const url = `${project.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}`;
  const response = await fetchFn(url, { headers: { "PRIVATE-TOKEN": token } });
  if (!response.ok) throw new Error(describeStatus(response.status));
  const body: unknown = await response.json();
  if (body && typeof body === "object" && "sha" in body && typeof body.sha === "string") {
    return body.sha || undefined;
  }
  return undefined;
}

/**
 * True when `sha` is HEAD or one of its ancestors, so the checked-out code
 * contains everything the reviewers saw. False when the commit is unknown
 * locally or HEAD sits on another line of history.
 */
export async function isCommitInHead(root: string, sha: string): Promise<boolean> {
  const result = await execa("git", ["merge-base", "--is-ancestor", sha, "HEAD"], {
    cwd: root,
    reject: false,
  });
  return result.exitCode === 0;
}

function threadBody(notes: GitLabNote[]): string {
  return notes
    .filter((n) => !n.system && n.body?.trim())
    .map((n) => `${n.author?.username ?? "unknown"}: ${n.body!.trim()}`)
    .join("\n\n");
}

/**
 * Keep unresolved diff threads that point at a line of the new file.
 * The body joins every note (with author) so follow-ups such as "fine to
 * ignore" reach the fixer.
 */
export function discussionsToComments(
  discussions: GitLabDiscussion[],
): DiscussionConversion {
  const comments: FileComment[] = [];
  let unmappable = 0;

  for (const discussion of discussions) {
    const first = discussion.notes?.[0];
    if (discussion.individual_note || !first || first.system) continue;
    if (first.type !== "DiffNote" || !first.resolvable || first.resolved) continue;

    const { new_path: path, new_line: line } = first.position ?? {};
    const body = threadBody(discussion.notes!);
    if (!path || !line || !body) {
      unmappable++;
      continue;
    }
    comments.push({ path, line, body, severity: "suggestion" });
  }
  return { comments, unmappable };
}
