---
name: reviuah-ci-integration
description: >-
  Use when modifying GitHub Actions or GitLab CI workflows, PR/MR commenting
  logic, or the --per-file CI integration.
---

# ReviuAh CI integration

## Overview

CI workflows run two review passes per PR/MR:
1. **Summary** → posted as a single PR/MR comment (create or update).
2. **Per-file** (`--per-file`) → inline comments on specific changed lines.

## GitHub Actions

- **File**: `.github/workflows/code-review.yml`
- **Trigger**: `pull_request` (opened, synchronize, reopened)
- **Permissions**: `contents: read`, `pull-requests: write`
- **Summary**: uses `actions/github-script@v7` to find/update comment by marker `<!-- reviuah-review -->`.
- **Per-file**: uses `pulls.createReview` with `comments` array (`path`, `line`, `side: RIGHT`).
- Previous inline reviews are dismissed before posting new ones to avoid duplicates.

## GitLab CI

- **File**: `.gitlab-ci-review.yml` (template — copy to target repo)
- **Trigger**: `only: merge_requests`
- **Variables**: `REVIUAH_API_KEY`, `GITLAB_TOKEN` (scope: `api`), `GIT_DEPTH: 0`
- **Summary**: `curl` + GitLab Notes API. Marker: `<!-- reviuah-review -->`.
- **Per-file**: `jq` parses `review.json`, `curl` posts each as MR discussion with position info.
- Fallback: if `jq` not available, per-file inline comments are skipped with a warning.

## Key design decisions

- **Marker-based idempotency**: HTML comment `<!-- reviuah-review -->` ensures only one summary comment exists per PR/MR. Updates replace; never duplicate.
- **Node version**: standardized on Node 22 LTS for CI. `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env for GitHub.
- **Output artifacts**: `review.md` and `review.json` are in `.gitignore` to prevent accidental commits.
- **Shell safety**: GitLab uses `--data-urlencode` for all curl payloads; never raw string interpolation.

## When modifying

- Ensure both summary + per-file steps remain independent (each with `|| true` to not fail pipeline).
- Keep `fetch-depth: 0` (GitHub) / `GIT_DEPTH: 0` (GitLab) for full history diff.
- Test with an actual PR/MR after changes — workflow syntax errors are only caught at runtime.
