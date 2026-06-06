# Codex Rules

## Core Rules

- Keep changes scoped to the requested behavior.
- Preserve Manifest V3 compatibility.
- Prefer the existing TypeScript/Vite structure and current module boundaries.
- Do not introduce new runtime dependencies unless they clearly reduce complexity.
- Do not commit generated build output unless explicitly requested.
- Follow `CONTRIBUTING.md` for contribution workflow and Conventional Commit messages.

## Extension Rules

- Keep privileged file-system logic out of the content script when possible.
- Use typed message contracts from `src/shared/messages.ts` for cross-context communication.
- Keep toolbar popup and options page settings behavior consistent.
- Keep UI language handling in shared locale/settings modules when possible.
- Be careful with X/Twitter DOM assumptions; prefer narrow selectors and defensive checks.
- Avoid collecting or persisting user data beyond the selected save-folder handle and required settings.
- Treat debug logs as development diagnostics, not product UI.

## Verification

- Use `pnpm` and the scripts defined in `package.json`.
- Run `pnpm format:check` after formatting-sensitive changes.
- Run `pnpm type` after TypeScript changes.
- Run `pnpm lint` after source or test changes.
- Run `pnpm test` after behavior or shared module changes.
- Run `pnpm knip` after adding, removing, or renaming files, exports, or dependencies.
- Run `pnpm build` before considering extension behavior complete.
- For browser behavior, load `dist/` in Chrome or Edge with Developer mode enabled.
- Do not rely on Vite localhost preview for extension behavior because Chrome extension APIs are required.

## Testing

- Test observable behavior, not implementation details.
- Prefer tests that keep passing when internals change but external behavior stays the same.
- Avoid coupling tests to private helper structure unless the helper is a stable module boundary.
