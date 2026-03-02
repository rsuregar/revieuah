# ReviuAh

> AI-powered CLI tool to review Git diffs before commit or push.\
> Designed for developers and AI agents.

---

## Core Concept

ReviuAh analyzes Git diffs (staged changes, commits, or branch ranges)
and generates structured code reviews using LLM providers such as
OpenAI, Gemini, DeepSeek, or Ollama.

Unlike commit message generators, ReviuAh: - Reads git diff - Sends the
diff to an AI provider - Produces structured review output - Optionally
fails CI if high risk is detected

---

## CLI Commands

```bash
# Review staged changes
reviuah

# Review specific commit
reviuah --commit HEAD

# Review branch diff
reviuah --range main...HEAD

# Output to markdown file
reviuah --out review.md

# Strict mode (exit 1 if high risk)
reviuah --strict

# Show configuration
reviuah --config

# Update configuration interactively
reviuah --config-update
```

---

## Required Review Output Structure

AI must return Markdown with the following sections:

1.  Summary\
2.  Risk Level (low / medium / high / unknown) + reasoning\
3.  Security Review\
4.  Performance Review\
5.  Testing Suggestions\
6.  Code Quality & Maintainability\
7.  Actionable Suggestions (max N bullets)

---

## Architecture

    src/
      cli.ts
      commands/
        review.ts
        config.ts
      git/
        diff.ts
      providers/
        index.ts
        openai.ts
        gemini.ts
        deepseek.ts
        ollama.ts
      config/
        load.ts
        schema.ts
      ui/
        interactive.ts
        render.ts

---

## Configuration Example

Default config file location:

\~/.reviuahconfig-v1

Example:

```json
{
  "provider": "OpenAI",
  "providerApiKey": "",
  "providerUrl": "https://api.openai.com/v1",
  "model": "gpt-4.1-mini",
  "reviewSpec": "Focus on correctness, edge cases, security, and testing. Keep it concise.",
  "maxDiffSize": 120000,
  "language": "id"
}
```

Configuration priority order:

1.  CLI arguments
2.  Environment variables
3.  Project config (.reviuahrc)
4.  Global config
5.  Defaults

---

## Strict Mode Behavior

If --strict is enabled:

- If risk level = high
- Exit with code 1
- Otherwise exit 0

This enables CI integration.

---

## Environment Variables

REVIUAH_PROVIDER\
REVIUAH_API_KEY\
REVIUAH_PROVIDER_URL\
REVIUAH_MODEL\
REVIUAH_SPEC

---

## Security Considerations

- Never log API keys
- Truncate large diffs
- Avoid sending secrets
- Support local-only mode via Ollama

---

## CI Example (GitHub Actions)

```yaml
name: AI Review

on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g reviuah
      - run: reviuah --range origin/main...HEAD --strict
        env:
          REVIUAH_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

---

## Development

```bash
npm install
npm run build
npm link
```

---

## Roadmap

v1 - OpenAI provider - Staged diff review - Strict mode - Markdown
output

v2 - Multiple providers - Interactive UI - Project-level rule presets

v3 - Patch suggestion mode - AI-assisted refactor mode - Review scoring

---

## Design Philosophy

ReviuAh is not: - A commit message generator - A code auto-modifier - A
replacement for human review

ReviuAh is: - A pre-review intelligence assistant - A risk detector - A
structured feedback generator - A CI gatekeeper
