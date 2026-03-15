# Contributing to ReviuAh

Thanks for your interest in contributing! ReviuAh is an open-source AI code review CLI, and we welcome contributions of all kinds.

## Getting started

```bash
git clone https://github.com/rsuregar/reviewah.git
cd reviewah
yarn install
yarn build
yarn link   # makes `reviuah` available globally
```

**Requirements:** Node.js 20+, Git, Yarn.

## Development workflow

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes — keep files under 300 lines; split if needed.
3. Run the type checker:
   ```bash
   yarn check
   ```
4. Build and test locally:
   ```bash
   yarn build
   reviuah --help
   ```
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/) format:
   ```
   feat(cli): add --json output flag
   fix(provider): handle 503 from Gemini
   ```
6. Push and open a Pull Request against `main`.

## Project structure

```
src/
├── cli.ts              # Entry point, Commander setup
├── commands/           # Command handlers (review, setup, update, etc.)
├── config/             # User config loading/resolving
├── git/                # Git diff helpers
├── lib/                # Shared utilities (update checker, package root)
├── providers/          # LLM provider abstraction (OpenAI-compatible)
└── ui/                 # Terminal UI (banner, spinner, setup wizard)
```

## Guidelines

- **TypeScript only** — no plain JS in `src/`.
- **KISS / DRY / YAGNI** — simple, no duplication, no speculative features.
- **No mocking in production** — mocks are for tests only.
- **English in code** — variable names, comments, error messages.
- **Don't touch `.env`** — never commit or overwrite env files.

## Adding a new provider preset

Provider presets live in `src/providers/openai.ts` inside the `PROVIDER_PRESETS` map. All providers use the OpenAI-compatible SDK. To add one:

1. Add an entry to `PROVIDER_PRESETS` with `baseURL` and `defaultModel`.
2. Update the setup wizard's template list in `src/ui/setup-wizard.ts`.
3. Update `README.md` environment variables table if needed.

## Reporting issues

- Use [GitHub Issues](https://github.com/rsuregar/reviewah/issues).
- Include your Node.js version, OS, and the full error output.
- For security vulnerabilities, email the maintainer directly (do not open a public issue).

## Code of conduct

Be respectful. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
