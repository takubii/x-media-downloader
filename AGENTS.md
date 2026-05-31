# Codex Rules

## Project Overview

- This repository contains a Chrome/Edge extension for saving images from X/Twitter posts to a user-selected local folder.

## Working Rules

- Keep changes scoped to the requested behavior.
- Prefer the existing TypeScript/Vite structure and current module boundaries.
- Do not introduce new runtime dependencies unless they clearly reduce complexity.
- Do not commit generated build output unless explicitly requested.

## Extension Constraints

- Preserve Manifest V3 compatibility.
- Keep privileged file-system logic out of the content script when possible.
- Use typed message contracts from `src/shared/messages.ts` for cross-context communication.
- Be careful with X/Twitter DOM assumptions; prefer narrow selectors and defensive checks.
- Avoid collecting or persisting user data beyond the selected save-folder handle and required settings.

## Development Commands

- Use `pnpm` for package management and scripts.
- Use the scripts defined in `package.json` for type checking, builds, and development workflows.

## Verification

- Run `pnpm type` after TypeScript changes.
- Run `pnpm build` before considering extension behavior complete.
- For browser behavior, load `dist/` in Chrome or Edge with Developer mode enabled and test on image posts.

## Code Style

- Use TypeScript with explicit types at module boundaries.
- Keep DOM and Chrome API error handling user-safe and debuggable.
- Prefer small helper functions in `src/shared/` for behavior reused across extension contexts.
- Keep comments short and only where they clarify non-obvious browser or extension behavior.

## When Unsure

- Check `README.md` for current product scope.
- Check `package.json` for available scripts.
- Ask before changing MVP scope, permissions, persistence behavior, or generated artifacts.
