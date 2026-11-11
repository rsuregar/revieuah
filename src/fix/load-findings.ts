import { resolve } from "node:path";
import type { FileComment } from "../providers/index.js";
import { loadReviewInput } from "./findings.js";
import {
  discussionsToComments,
  fetchDiscussions,
  fetchMrHeadSha,
  getOriginUrl,
  isCommitInHead,
  parseGitLabRemote,
  type GitLabProject,
} from "./gitlab-discussions.js";

export interface FindingsSource {
  input?: string;
  mr?: string;
}

/** `--mr` must be a positive integer; reject anything else before it reaches a URL. */
export function parseMrIid(value: string): number {
  if (!/^[1-9]\d*$/.test(value.trim())) {
    throw new Error(`--mr must be a merge request number (e.g. 1237), got: ${value}`);
  }
  return Number(value.trim());
}

export function assertSingleSource(source: FindingsSource): void {
  if (source.input && source.mr) {
    throw new Error("Use only one of --input or --mr.");
  }
  if (!source.input && !source.mr) {
    throw new Error(
      "Missing a source. Use --input <review.json> (from: reviuah --per-file --out review.json) or --mr <number> for GitLab.",
    );
  }
}

/**
 * The token goes into an HTTP header, so reject anything but printable ASCII
 * without whitespace. Never echo the value: it is a secret, and the usual
 * cause is extra shell-startup output (e.g. a theme banner) captured with it.
 */
export function parseGitLabToken(raw: string | undefined): string {
  const token = raw?.trim();
  if (!token) {
    throw new Error("GITLAB_TOKEN is not set. Create a token with read_api scope and export it.");
  }
  if (!/^[\x21-\x7e]+$/.test(token)) {
    throw new Error(
      "GITLAB_TOKEN contains whitespace or non-printable characters (value not shown). Check how it is exported; shell startup output may have been captured into it.",
    );
  }
  return token;
}

async function warnIfCheckoutLacksMrHead(
  project: GitLabProject,
  iid: number,
  token: string,
  root: string,
): Promise<void> {
  const sha = await fetchMrHeadSha(project, iid, token);
  if (sha && !(await isCommitInHead(root, sha))) {
    console.error(
      `Warning: MR head ${sha.slice(0, 8)} is not in the checked-out history. Line numbers and code may not match the review comments; check out the MR's source branch (and pull) first.`,
    );
  }
}

async function loadFromGitLab(mr: string, root: string): Promise<FileComment[]> {
  const iid = parseMrIid(mr);
  const token = parseGitLabToken(process.env.GITLAB_TOKEN);
  const project = parseGitLabRemote(await getOriginUrl(root));
  console.error(`GitLab: ${project.projectPath} MR !${iid}`);
  await warnIfCheckoutLacksMrHead(project, iid, token, root);

  const { comments, unmappable } = discussionsToComments(
    await fetchDiscussions(project, iid, token),
  );
  console.error(`Found ${comments.length} unresolved diff thread(s) on the new file.`);
  if (unmappable > 0) {
    console.error(
      `Skipped ${unmappable} unresolved thread(s) without a new-file line (e.g. comments on removed lines).`,
    );
  }
  return comments;
}

export async function loadFindings(
  source: FindingsSource,
  root: string,
): Promise<FileComment[]> {
  assertSingleSource(source);
  return source.mr
    ? loadFromGitLab(source.mr, root)
    : loadReviewInput(resolve(process.cwd(), source.input!));
}
