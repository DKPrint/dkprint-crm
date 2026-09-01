# DKPrint CRM — agent notes

- Spec: `docs/DKPrint-CRM-TZ-v1.md`
- Ops / handoff: `OPS.md`, `HANDOFF.md`
- Design tokens/CSS: `design-system/dkprint-crm/`
- Orchestration: cocolwy/cursor-agents (MCCA) — use `/code`, `/goal`, `/review`, `/commit`
- Project rules: `.cursor/rules/00-dkprint-invariants.mdc` (+ `03-pre-push`, `04-safety`, `05` SoT / `06` contracts / `07` auth-webhooks)
- Before push: `npm run typecheck && npm run lint && npm run format:check && npm test`
- Do not reintroduce the old static demo; this repo is the Next.js app.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
