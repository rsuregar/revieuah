# Guide: All CLI Commands & Environment Variables

Complete reference for every ReviuAh CLI command and environment variable.

---

## Commands overview

| Command | Description |
|---------|--------------|
| `reviuah` | Run review (default: staged changes). Review options can be combined. |
| `reviuah setup` | Interactive setup: save API key & provider to `~/.reviuah/config.json` |
| `reviuah config` | Show config file path and API key status |
| `reviuah config --update` | Run setup again to change config |
| `reviuah version <patch\|minor\|major>` | Bump package version (for release) |
| `reviuah update` | Reinstall dependencies and rebuild (development) |
| `reviuah fix --input <file>` / `--mr <n>` | Apply review findings (from `review.json` or GitLab MR threads) as approved patches (see §6) |

Aliases: **`reviu`** = **`reviewah`** = **`reviuah`** (identical).

---

## 1. Review (main command)

Without a subcommand, `reviuah` runs a **review**. Diff source can be: staged, a single commit, or a range.

### Diff source (choose one)

| Option | Example | Meaning |
|--------|---------|---------|
| *(default)* | `reviuah` | Review **staged changes** only (`git diff --staged`) |
| `--commit <ref>` | `reviuah --commit HEAD` | Review a single commit |
| `--range <range>` | `reviuah --range main...HEAD` | Review a git range |
| `--base <ref>` | `reviuah --base main` | Same as `--range <ref>...HEAD` (branch vs base) |

Example ranges: `origin/main...HEAD`, `develop...feature/foo`.

### Review options (can be combined)

| Option | Default | Description |
|--------|---------|--------------|
| `--lang <code>` | `en` | Output language for the review (e.g. `en`, `id`) |
| `--out <file>` | — | Write review to file (markdown or JSON) |
| `--strict` | `false` | Exit with code 1 when risk level is **high** (for CI gate) |
| `--per-file` | `false` | Output JSON with per-line comments (for CI inline comments) |
| `--summary` / `--no-summary` | `true` | Enable/disable summary markdown generation |
| `--compact` / `--no-compact` | `true` | Compact review mode is now the default best-practice behavior. Use `--no-compact` to opt out and request the fuller review format. |
| `--prompt <text>` | — | Custom instructions for the reviewer (e.g. focus on security, style guide). Or use a file in repo root (see below). |

### Example combinations

```bash
# Staged only, Indonesian (compact mode is on by default)
reviuah --lang id

# Branch vs main, save to file
reviuah --base main --out review.md

# Opt out of compact mode for a fuller review
reviuah --base main --no-compact

# Explicit range + custom prompt
reviuah --range origin/main...HEAD --prompt "Focus on security and error handling."

# Per-file JSON (for CI)
reviuah --range origin/main...HEAD --per-file --out review.json --lang en

# Disable summary markdown generation
reviuah --range origin/main...HEAD --no-summary --out review.md

# Fail CI when risk is high
reviuah --base origin/main --strict --out review.md
```

**Custom prompt from file:** Place a file named `reviuah-prompt.md` in the **git repository root of the project you are reviewing**. If you don’t pass `--prompt` and don’t set `REVIUAH_CUSTOM_PROMPT`, ReviuAh will use that file’s contents as the custom prompt. Use Markdown for structure (headings, lists). Commit the file to share review rules with your team. This file is read from the repo where you run `reviuah`, not from the ReviuAh tool repository.

**Example `reviuah-prompt.md`:**

```md
# Review role
Act as a senior frontend engineer specializing in React and Next.js.

# Review principles
Apply these principles when reviewing:
- SOLID
- KISS
- DRY
- Clean Code

# Review scope
Focus on:
- component design and responsibilities
- state management and data flow
- hooks usage and side effects
- server/client boundaries in Next.js
- rendering performance
- accessibility
- readability and maintainability

# Severity threshold
Only report findings when severity is medium, high, or critical.
Ignore low-severity suggestions and minor style nits.

# Review style
- Be concise and specific.
- Prefer actionable findings.
- Do not comment unless there is a meaningful issue or risk.
- When possible, explain the impact and the recommended fix briefly.
```

---

## 2. Setup — `reviuah setup`

Saves API key and provider to `~/.reviuah/config.json`. Used when env vars are not set.

| Option | Description |
|--------|--------------|
| `--wizard` | Force full TUI form even when terminal is not detected as TTY |
| `--no-wizard` | Use simple text prompts only (no blessed TUI) |

```bash
reviuah setup
reviuah setup --no-wizard   # text prompts only
reviuah setup --wizard      # force full form
```

---

## 3. Config — `reviuah config`

Shows config file path and API key status (masked).

| Option | Description |
|--------|-------------|
| `--update` | Run setup again (same as `reviuah setup`) |

```bash
reviuah config
reviuah config --update
```

---

## 4. Version — `reviuah version <type>`

Bumps the version in `package.json`. For releases (typically used by maintainers).

| Type | Example | Use case |
|------|---------|----------|
| `patch` | 1.0.0 → 1.0.1 | Bugfix |
| `minor` | 1.0.1 → 1.1.0 | New feature |
| `major` | 1.1.0 → 2.0.0 | Breaking change |

```bash
reviuah version patch
reviuah version minor
reviuah version major
```

Must be run from the **project root** (where `package.json` lives).

---

## 5. Update — `reviuah update`

Reinstalls dependencies (`yarn install`) and builds (`yarn build`). Useful after `git pull` or during development.

```bash
reviuah update
```

Must be run from the **ReviuAh project root** (not from another repo).

---

## 6. Fix — `reviuah fix`

Applies the comments of a per-file review as patches to the working tree. Each patch is shown as a diff and needs approval; nothing is committed.

```bash
reviuah --base main --per-file --out review.json
reviuah fix --input review.json --verify "yarn lint && yarn test"
```

| Option | Default | Description |
|--------|---------|-------------|
| `--input <file>` | — | `review.json` from `--per-file --out`. Use this **or** `--mr` |
| `--mr <number>` | — | GitLab merge request number (needs `GITLAB_TOKEN`). Use this **or** `--input` |
| `--verify <cmd>` | `REVIUAH_FIX_VERIFY_CMD` | Run before patching (baseline) and once after all patches |
| `--dry-run` | `false` | Print diffs only; write nothing |
| `--yes` | `false` | Apply every valid patch without prompting; never stages. Required without a TTY unless `--dry-run` |
| `--lang <code>` | `en` | Language of the explanations |
| `--prompt <text>` | — | Extra instructions. `AGENTS.md` (first 8000 chars) and `reviuah-prompt.md` / `REVIUAH_CUSTOM_PROMPT` are included too |

Approval keys: `y` apply, `n` skip, `a` apply all remaining, `q` quit. Unknown input means no.

- A patch is a search/replace block that must match the file exactly and exactly once, else it is skipped. Line numbers in `review.json` are hints only.
- Only files named in the review are touched. Absolute paths, `..`, and symlinks leaving the repo are refused. Lockfiles, build output, binaries, `REVIUAH_DIFF_EXCLUDE_PATTERNS` matches, and files over `REVIUAH_MAX_DIFF_SIZE` are skipped and not sent to the model; other file content is sent to the configured provider.
- Verification failure: rollback (default), try again once with the failure output as context, or keep. With `--yes` it rolls back. Rollback restores patched files only; git index and stash are untouched. Exit code is 1 on failed verification.
- No `--verify` / `REVIUAH_FIX_VERIFY_CMD`, or a failing baseline: patches are applied but unverified, and `git add` is not offered.
- `--mr <number>`: fetches the MR's discussions from GitLab and keeps unresolved diff threads on a line of the new file. A thread's body joins all its notes with authors, so follow-ups like "fine to ignore" reach the fixer. Threads on removed lines are skipped and reported. MR comments are untrusted input, so `--yes` is refused with `--mr`.
- After passing verification, `git add` is offered for patched files that had no unstaged changes beforehand.

---

## Environment variables

Env vars **override** the config file. Useful for CI or one-off overrides.

| Variable | Required? | Default | Description |
|----------|-----------|---------|-------------|
| `REVIUAH_API_KEY` | **Yes** | — | API key for the provider (OpenAI, Gemini, etc.) |
| `REVIUAH_PROVIDER` | No | `agentrouter` | Preset: `openai`, `gemini`, `anthropic`, `deepseek`, `groq`, `mistral`, `together`, `fireworks`, `openrouter`, `cerebras`, `glm`, `ollama`, `agentrouter` |
| `REVIUAH_PROVIDER_URL` | No | from preset | Override API base URL |
| `REVIUAH_MODEL` | No | from preset | Override model name |
| `REVIUAH_COMMAND` | With `REVIUAH_PROVIDER=command` | — | Shell command that reads the prompt on stdin and prints the answer on stdout, e.g. `omp -p --no-tools --no-session --model google-antigravity/gemini-2.5-flash`. The CLI handles its own login; no API key is used. Runs through your shell, so set it only from your own env or `~/.reviuah/config.json`. |
| `REVIUAH_MAX_DIFF_SIZE` | No | 120000 | Max characters of diff sent after ReviuAh filters token-heavy files, prioritizes higher-signal files, and truncates at file boundaries (smaller = cheaper) |
| `REVIUAH_REQUEST_TIMEOUT_MS` | No | 60000 | Request timeout to API (ms) |
| `REVIUAH_ENABLE_SUMMARY` | No | enabled | Set `0` / `false` to disable summary markdown generation (same as `--no-summary`) |
| `REVIUAH_COMPACT` | No | enabled | Compact review mode is the default best-practice behavior. Set `0` / `false` to disable it, or use `--no-compact` from the CLI. |
| `REVIUAH_MAX_OUTPUT_TOKENS` | No | provider default | Cap completion length (for example `1500`) to reduce output tokens |
| `REVIUAH_DIFF_EXCLUDE_PATTERNS` | No | — | Extra comma-separated regex patterns for diff paths to exclude before sending to the LLM (for example `(^|/)fixtures/,\\.snap$`) |
| `REVIUAH_LOG_TOKEN_BUDGET` | No | disabled | Set `1` / `true` to print an estimated input token budget summary after diff preparation |
| `REVIUAH_CUSTOM_PROMPT` | No | — | Custom instructions for the reviewer (same as `--prompt`). If unset, ReviuAh uses `reviuah-prompt.md` in repo root when present. See the sample prompt example above for a reusable team template. |
| `REVIUAH_FIX_VERIFY_CMD` | No | — | Command `reviuah fix` runs before and after patching (same as `--verify`), e.g. `yarn lint && yarn test`. Without it, patches are applied but marked unverified and never offered for staging. |
| `GITLAB_TOKEN` | For `fix --mr` | — | GitLab token with `read_api` scope. Read-only; ReviuAh never writes to GitLab. The host and project come from `git remote get-url origin` (https, `ssh://`, and scp-like remotes; self-hosted works). |

### Example usage with env

```bash
# One-off override
REVIUAH_PROVIDER=gemini REVIUAH_MODEL=gemini-2.0 reviuah --base main

# Custom prompt via env (CI)
export REVIUAH_CUSTOM_PROMPT="Focus on security and SQL injection."
reviuah --range origin/main...HEAD --out review.md

# Limit diff size (save tokens)
REVIUAH_MAX_DIFF_SIZE=50000 reviuah --base main

# Compact mode is the default best-practice behavior
reviuah --base main

# Disable compact mode explicitly
REVIUAH_COMPACT=0 reviuah --base main

# Cap output tokens
REVIUAH_MAX_OUTPUT_TOKENS=1500 reviuah --base main

# Exclude extra low-value paths from the diff
REVIUAH_DIFF_EXCLUDE_PATTERNS="(^|/)fixtures/,\\.snap$" reviuah --base main

# Log estimated prompt budget to stderr
REVIUAH_LOG_TOKEN_BUDGET=1 reviuah --base main

# Disable summary generation from env
REVIUAH_ENABLE_SUMMARY=0 reviuah --base main --out review.md
```

### Token optimization notes

ReviuAh now reduces prompt size more intelligently before sending a review request:

- Filters token-heavy files such as lockfiles, build artifacts, minified assets, and common binary files from the diff.
- Lets you exclude additional paths with `REVIUAH_DIFF_EXCLUDE_PATTERNS` using comma-separated regex patterns.
- Prioritizes higher-signal file sections when the diff is still too large, so source code is more likely to be kept than low-signal docs or config churn.
- Truncates large diffs at file boundaries instead of hard-cutting raw text mid-file.
- Uses compact mode by default as the best-practice review path, which keeps output shorter and uses smaller git diff context to reduce tokens further.
- You can opt out with `--no-compact` or `REVIUAH_COMPACT=0` when you want the fuller review format.
- Can print an estimated input token budget with `REVIUAH_LOG_TOKEN_BUDGET=1`, which is useful in CI tuning.

For the lowest token usage in CI, combine these settings:

```bash
REVIUAH_MAX_DIFF_SIZE=50000 REVIUAH_MAX_OUTPUT_TOKENS=1500 REVIUAH_DIFF_EXCLUDE_PATTERNS="(^|/)fixtures/,\\.snap$" reviuah --base main
```

---


## AgentRouter: testing with curl

Default provider **AgentRouter** is OpenAI-compatible. Base URL: `https://agentrouter.org/v1`. You can hit the same endpoint ReviuAh uses with curl:

```bash
# Set your API key (same as REVIUAH_API_KEY)
export API_KEY="your-agentrouter-api-key"

# Chat completions (same shape ReviuAh uses)
curl -s "https://agentrouter.org/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Say hello in one word."}],
    "max_tokens": 50
  }'
```

Response is JSON with `choices[0].message.content`. Use the same `Authorization: Bearer <key>` and body shape when calling from another client.

---

## Configuration priority

**API / provider:**  
1. Environment variables (highest)  
2. Config file `~/.reviuah/config.json` (from `reviuah setup`)  
3. Defaults from the provider preset  

**Custom prompt:**  
1. CLI `--prompt "..."`  
2. Env `REVIUAH_CUSTOM_PROMPT`  
3. File `reviuah-prompt.md` in the target git repo root where you run `reviuah` (if present)

---

## Quick help

```bash
reviuah --help
reviuah setup --help
reviuah config --help
```

See also: [README](../README.md), [CI setup guide](./ci-setup-guide.md), [Usage guide](./usage-guide.md).
