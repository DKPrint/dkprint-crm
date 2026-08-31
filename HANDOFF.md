# HANDOFF — DKPrint CRM

Short status for a new chat / agent. Spec: `@docs/DKPrint-CRM-TZ-v1.md` (**v1.6**). Ops: `@OPS.md`.

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
- Cron `/api/cron/sla-overdue` + OPS/HANDOFF drafts
- Cursor rules: DKPrint invariants + SoT / contracts / auth-webhooks + pre-push CI
- **9b.1 catalog schema** (`migrations/005_catalog.sql` + greenfield in `001_init.sql`): `catalog_categories` / `catalog_products` / BOM / `catalog_import_runs`; `order_items.catalog_product_id`, `is_manual`; `category_id` nullable
- **9b.2 admin catalog** — `/admin/catalog` + `/api/admin/catalog/categories|products` (admin-only); tree + products + price edit; BOM not in product list

## Next (priority)

1. **Фаза 9b — Каталог (остаток)** (§13.1): import/export xlsx, public read API for order form, cascading + manual line, price snapshot on create/add
2. **Фаза 6** — Clients + Tasks (pages are stubs today)
3. **Фаза 9** — Admin users UI
4. **Фаза 7** — Admin SLA UI (cron API already exists)
5. **Фаза 8** — Reports + export
6. **Фаза 10** — Full §22 acceptance

## Not done / stubs (do not claim complete)

- `/tasks`, `/clients`, `/reports`, `/admin/users`, `/admin/categories`, `/admin/sla` — placeholder `<h1>` only
- Product catalog UI/API (§13.1) — admin CRUD+price done; import/export + order-form read still open
- Warehouse write-off — roadmap +2 (BOM tables exist)
- Public calculator / site dual pricing — out of v1

## Do not

- Reintroduce the old static demo UI
- Use IEEE float for money; bypass `lib/money`
- Change status outside `status_transitions` (+ admin jump)
- Put secrets in `NEXT_PUBLIC_*` or commit real `.env`
- Call `syncOrderTelegramCard` from item add/patch/delete/price
- Trust UI-only hiding as authorization
- Barrel-re-export inside `"use server"` files
- Ship catalog as a separate microservice in v1 (module in same app)
- Store full catalog+prices in browser as SoT; always resolve catalog line price on server

## Before push

`npm run typecheck && npm run lint && npm run format:check && npm test`

## Neon checklist

Apply in order if the DB was created from an older `001` (or never got later files):

1. `migrations/002_orders_telegram_message_id.sql`
2. `migrations/003_orders_is_urgent.sql`
3. `migrations/004_order_items_name.sql`
4. **`migrations/005_catalog.sql`** — `catalog_*` + `order_items.catalog_product_id` / `is_manual` + nullable `category_id`

Fresh greenfield: run current `001_init.sql` (includes catalog) + `seed.sql`, then skip `002`–`005` only if those columns/tables already exist.

Smoke after `005`: `\d catalog_products`, `\d order_items` — expect `catalog_product_id`, `is_manual`, nullable `category_id`.
