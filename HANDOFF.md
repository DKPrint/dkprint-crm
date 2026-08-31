# HANDOFF — DKPrint CRM

Short status for a new chat / agent. Spec: `@docs/DKPrint-CRM-TZ-v1.md` (v1.5). Ops: `@OPS.md`.

## Done (shipped on main)

- Auth.js v5 Credentials + JWT; `requireAuth` reloads user/`is_active`/flags from DB
- Orders CRUD isolation (`assertOrderAccess` / `ordersVisibleWhere`)
- Status graph + cancel / soft-delete / admin jump
- Money via `lib/money` + NUMERIC(12,2)
- R2 presigned upload/download (key uses `orderNumber`)
- Comments + problematic layout → Web Push + TG card edit
- Telegram **live card** (one message / order; sync on create, status, comment, urgent, SLA — **not** on item CRUD)
- Workshop compact table + composition lines + `hasLayout`
- Orders list poll 30s + urgent checkbox
- Item field `name` (migration 004)
- Audit UI/API: admin \| production only; readable labels; no-op patch skip
- Admin: users / categories / SLA basics
- Cursor rules: DKPrint invariants + SoT / contracts / auth-webhooks + pre-push CI

## Not done / stubs (do not claim complete)

- `/tasks` and `/reports` — placeholder pages; no full API/UI per TZ §12.3–12.4
- Public calculator / site dual pricing — out of v1
- Login rate-limit, order create Idempotency-Key — deferred hardening
- R2 orphan cleanup — roadmap

## Do not

- Reintroduce the old static demo UI
- Use IEEE float for money; bypass `lib/money`
- Change status outside `status_transitions` (+ admin jump)
- Put secrets in `NEXT_PUBLIC_*` or commit real `.env`
- Call `syncOrderTelegramCard` from item add/patch/delete/price
- Trust UI-only hiding as authorization
- Barrel-re-export inside `"use server"` files

## Before push

`npm run typecheck && npm run lint && npm run format:check && npm test`

## Neon checklist

Confirm migrations `002`–`004` applied if DB was created from older `001` only.
