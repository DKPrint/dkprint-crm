# DKPrint CRM — agent notes

- Spec: `docs/DKPrint-CRM-TZ-v1.md`
- Ops / handoff: `OPS.md`, `HANDOFF.md`
- Design tokens/CSS: `design-system/dkprint-crm/`
- Orchestration: cocolwy/cursor-agents (MCCA) — use `/code`, `/goal`, `/review`, `/commit`
- Project rules: `.cursor/rules/00-dkprint-invariants.mdc` (+ `03-pre-push`, `04-safety`, `05` SoT / `06` contracts / `07` auth-webhooks)
- Before push: `npm run typecheck && npm run lint && npm run format:check && npm test`
- Do not reintroduce the old static demo; this repo is the Next.js app.
