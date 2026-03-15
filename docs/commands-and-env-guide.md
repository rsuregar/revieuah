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

Alias: **`reviewah`** = **`reviuah`** (identical).

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
| `--prompt <text>` | — | Custom instructions for the reviewer (e.g. focus on security, style guide). Or use a file in repo root (see below). |

### Example combinations

```bash
# Staged only, Indonesian
reviuah --lang id

# Branch vs main, save to file
reviuah --base main --out review.md

# Explicit range + custom prompt
reviuah --range origin/main...HEAD --prompt "Focus on security and error handling."

# Per-file JSON (for CI)
reviuah --range origin/main...HEAD --per-file --out review.json --lang en

# Fail CI when risk is high
reviuah --base origin/main --strict --out review.md
```

**Custom prompt from file:** Place a file named `reviuah-prompt.md` in your **git repository root**. If you don’t pass `--prompt` and don’t set `REVIUAH_CUSTOM_PROMPT`, ReviuAh will use that file’s contents as the custom prompt. Use Markdown for structure (headings, lists). Commit the file to share review rules with your team.

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

## Environment variables

Env vars **override** the config file. Useful for CI or one-off overrides.

| Variable | Required? | Default | Description |
|----------|-----------|---------|-------------|
| `REVIUAH_API_KEY` | **Yes** | — | API key for the provider (OpenAI, Gemini, etc.) |
| `REVIUAH_PROVIDER` | No | `agentrouter` | Preset: `openai`, `gemini`, `anthropic`, `deepseek`, `groq`, `mistral`, `together`, `fireworks`, `openrouter`, `cerebras`, `glm`, `ollama`, `agentrouter` |
| `REVIUAH_PROVIDER_URL` | No | from preset | Override API base URL |
| `REVIUAH_MODEL` | No | from preset | Override model name |
| `REVIUAH_MAX_DIFF_SIZE` | No | 120000 | Max characters of diff sent (smaller = cheaper) |
| `REVIUAH_REQUEST_TIMEOUT_MS` | No | 60000 | Request timeout to API (ms) |
| `REVIUAH_CUSTOM_PROMPT` | No | — | Custom instructions for the reviewer (same as `--prompt`). If unset, ReviuAh uses `reviuah-prompt.md` in repo root when present. |

### Example usage with env

```bash
# One-off override
REVIUAH_PROVIDER=gemini REVIUAH_MODEL=gemini-2.0 reviuah --base main

# Custom prompt via env (CI)
export REVIUAH_CUSTOM_PROMPT="Focus on security and SQL injection."
reviuah --range origin/main...HEAD --out review.md

# Limit diff size (save tokens)
REVIUAH_MAX_DIFF_SIZE=50000 reviuah --base main
```

---

## Configuration priority

**API / provider:**  
1. Environment variables (highest)  
2. Config file `~/.reviuah/config.json` (from `reviuah setup`)  
3. Defaults from the provider preset  

**Custom prompt:**  
1. CLI `--prompt "..."`  
2. Env `REVIUAH_CUSTOM_PROMPT`  
3. File `reviuah-prompt.md` in git repo root (if present)

---

## Quick help

```bash
reviuah --help
reviuah setup --help
reviuah config --help
```

See also: [README](../README.md), [CI setup guide](./ci-setup-guide.md), [Usage guide](./usage-guide.md).
