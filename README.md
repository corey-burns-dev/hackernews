# Hackernews Afterglow

I built this because I wanted a prettier Hacker News to read.

This app is a Hacker News client built with Next.js. It fetches live stories and comments from the official HN Firebase API and presents them in a cleaner, more visual layout.

## Run locally

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
bun run dev
bun run build
bun run start
bun run lint
bun run lint:fix
bun run format
bun run format:check
```

## Commit quality checks

This repo uses:

- `husky` for Git hooks
- `lint-staged` to run checks only on staged files
- `prettier` for formatting
- `eslint` for linting

On every commit, staged files are formatted and linted automatically through `.husky/pre-commit`.
