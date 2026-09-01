# OPS — DKPrint CRM

Operational notes for staging/prod. **No secret values** in this file — only names and procedures.

Canonical product/tech spec: `docs/DKPrint-CRM-TZ-v1.md` (v1.6). Agent handoff: `HANDOFF.md`. QA checklist: `docs/QA-22-acceptance-report.md`.

## Phase status (§21 / §20.11)

| Phase   | Deliverable                                                      | Status                                               |
| ------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| 0–5, 5+ | Core platform (auth, orders, R2, UI, workshop, notify, cron API) | **Done**                                             |
| 6       | Clients + Tasks                                                  | **Done**                                             |
| 7       | Admin SLA UI                                                     | **Done**                                             |
| 8       | Reports + export                                                 | **Done**                                             |
| 9       | Admin users                                                      | **Done**                                             |
| 9b      | Catalog §13.1                                                    | **Done** (prod 1С import **deferred** — see Catalog) |
| 10      | QA §22 + OPS/HANDOFF final                                       | **In progress** (manual role smoke pending)          |

**Stub / out of v1:** warehouse write-off (+2), public calculator, E2E all roles.

## Source of truth map

| Data                               | Owner (SoT)                                     | Notes                                                                |
| ---------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| Users / roles / permission flags   | CRM DB (`users`, `permission_overrides`)        | Admin creates users; no public signup                                |
| Clients (photo centers)            | CRM DB (`clients`)                              | External clients: admin soft-delete; photo_center rows not deletable |
| Orders + status                    | CRM DB (`orders`) + `status_transitions`        | Status only via transitions (+ admin jump)                           |
| Prices / line totals / order total | CRM + `lib/money`                               | Server `formatMoney2` / recalc; catalog line price from DB snapshot  |
| Order item `name`, qty, tech       | CRM (`order_items`)                             |                                                                      |
| Files / R2 keys                    | CRM (`files`) + R2                              | Key: `dkprint/{R2_ENV}/orders/{orderNumber}/items/...`               |
| Audit / status events              | CRM (`order_audit_logs`, `order_status_events`) | Audit UI/API: admin \| production only                               |
| Telegram live card                 | CRM `orders.telegram_message_id` + Bot API      | Outbound only; chat = `TELEGRAM_CHAT_ID` (рабочая группа)            |
| Telegram dev/ops alerts            | Bot API + `TELEGRAM_DEV_CHAT_ID`                | One-shot messages; CI/cron/infra — **не** карточки заказов           |
| Web Push subscriptions             | CRM + VAPID                                     | Event-driven; not TG                                                 |
| Categories / SLA defaults          | CRM admin                                       | Prefer deactivate over hard-delete                                   |
| Product catalog / list prices      | CRM `catalog_*` (§13.1)                         | Admin import/export; order lines snapshot price; not browser SoT     |
| Consumables BOM                    | `catalog_product_consumables`                   | Schema + minimal admin UI in v1; warehouse write-off = roadmap +2    |

Do **not** treat client-submitted floats as money truth without going through `lib/money`.

### Client soft-delete (§7)

- **Who:** admin only (`POST /api/clients/[id]/soft-delete` with `{ comment }`).
- **Blocked:** `clients.user_id IS NOT NULL` (photo_center / точка сети) → 422.
- **Effect:** sets `deleted_at`, `deleted_by_user_id`, `delete_comment`; row hidden from list/create-order by default.
- **Orders:** existing orders stay linked; not auto-cancelled.
- **Admin:** `includeDeleted=1` on `GET /api/clients` and client card (same pattern as orders).

### Permission denials (§3.2)

- `permission_overrides.deny_*` mirror grant flags; checked in `can()` after hard role blocks.
- Admin user form: uncheck role-granted right → sets `deny_*=true` (label «снято администратором»).
- Designer cancel/soft-delete and photo_center/courier reports remain hard-denied regardless of deny flags.

### Catalog import/export xlsx (§13.1)

Admin-only: `POST /api/admin/catalog/import`, `GET /api/admin/catalog/export`. Max **10 MB**; MIME xlsx; server parses values only (no formula execution). Match key = `external_code` (`product_code` in file). Log: `catalog_import_runs`.

**Staging:** stub categories/products via admin UI or small test file — **do not** run prod 1С import until leaf-policy fix + OPS sign-off.

**Prod import deferred:** rows without valid leaf subcategory when root already has children may attach products to non-leaf — fix after real 1С sample; then smoke import → export → re-import with ☑ replace prices.

**Sheet 1, row 1 — headers** (English canonical; Russian aliases accepted, case-insensitive):

| Column | Header             | Required       | DB field                                                                  |
| ------ | ------------------ | -------------- | ------------------------------------------------------------------------- |
| A      | `category_code`    | no             | `catalog_categories.external_code` (root)                                 |
| B      | `category_name`    | yes            | root name on create                                                       |
| C      | `subcategory_code` | no             | subcategory `external_code`                                               |
| D      | `subcategory_name` | if subcategory | subcategory name on create                                                |
| E      | `product_code`     | yes            | `catalog_products.external_code` (match key)                              |
| F      | `product_name`     | yes            | name on create                                                            |
| G      | `unit_price`       | yes            | `unit_price` on create; with ☑ replace prices — update only this on match |

**Import rules:** existing `product_code` → skip fields; ☑ «Заменить цены» → update `unit_price` only. No code in DB → insert category/subcategory/product. Re-import without codes on categories may duplicate (use codes from 1С).

Products without `external_code` export as `crm:{uuid}` for round-trip re-import (prefix not stored as `external_code`).

Export uses the same column layout.

## R2 (Cloudflare)

- **Storage class:** **Standard** (default for new buckets; no Infrequent Access in v1).
- **Buckets:** one bucket per env recommended (`R2_BUCKET`); isolate via `R2_ENV` prefix in keys (`staging` \| `prod` only — app fails closed otherwise).
- **Key format:** `dkprint/{R2_ENV}/orders/{orderNumber}/items/{itemId}/{filename}` — never order UUID.
- **Flow:** presign PUT → client upload → confirm (server checks object exists); download via presigned GET.
- **Env:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_ENV`.
- **Smoke:** upload JPEG/PDF on order item → download; verify key in DB matches pattern.

## Env names (values in Vercel / `.env` only)

| Name                                       | Purpose                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `DATABASE_URL`                             | Neon Postgres                                                              |
| `AUTH_SECRET`                              | Auth.js                                                                    |
| `APP_URL`                                  | Absolute links (TG cards). Set in prod — do not rely on localhost fallback |
| `APP_TIMEZONE`                             | Order numbers / calendar day (e.g. `Europe/Minsk`)                         |
| `CRON_SECRET`                              | Bearer for `/api/cron/sla-overdue`                                         |
| `R2_*`                                     | Cloudflare R2 (`R2_ENV` = staging \| prod)                                 |
| `VAPID_*`                                  | Web Push                                                                   |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`  | Order live cards (рабочая группа)                                          |
| `TELEGRAM_DEV_CHAT_ID`                     | Dev/ops alerts (отдельная группа; тот же бот)                              |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | First admin only (`npm run seed:admin`)                                    |
| `SEED_DEMO_PASSWORD`                       | Optional demo roster (`npm run seed:demo`)                                 |

See `.env.example`. **Never** commit real values or put secrets in `NEXT_PUBLIC_*`.

## Migrations (Neon — apply in order)

| #   | File                                              | Purpose                                                                                   |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | `migrations/001_init.sql`                         | Greenfield schema (includes catalog tables from 9b.1)                                     |
| 2   | `migrations/seed.sql`                             | Legacy categories, SLA default, status transitions                                        |
| 3   | `migrations/002_orders_telegram_message_id.sql`   | TG card pointer                                                                           |
| 4   | `migrations/003_orders_is_urgent.sql`             | Urgent flag                                                                               |
| 5   | `migrations/004_order_items_name.sql`             | Item display name                                                                         |
| 6   | `migrations/005_catalog.sql`                      | `catalog_*` + `order_items.catalog_product_id` / `is_manual` / nullable `category_id`     |
| 7   | `migrations/006_clients_soft_delete.sql`          | Client soft-delete columns                                                                |
| 8   | `migrations/007_permission_denials.sql`           | `permission_overrides.deny_*` flags                                                       |
| 9   | `migrations/008_order_items_catalog_category.sql` | Catalog category snapshot on order lines (`catalog_category_id`, `catalog_category_path`) |
| 10  | —                                                 | `npm run seed:admin`                                                                      |

**Existing DBs:** run `002` → `005` if created from older `001`. **Fresh greenfield:** current `001` + `seed` — skip `002`–`005` only if those objects/columns already exist.

**Prod gate:** without `005`, `POST /api/orders` with catalog lines **500** (missing columns).

Optional demo: `CONFIRM_SEED_DEMO=yes npm run seed:demo` (after admin seed).

**Full staging reset (§22 manual smoke):** `CONFIRM_WIPE_QA=yes npm run seed:wipe-qa` — wipes orders, clients, catalog, tasks, push, notifications, **all users**; recreates super-admin from `SEED_ADMIN_*` + demo roster. Refuses `R2_ENV=prod` unless `CONFIRM_WIPE_PROD=yes`. Does not delete R2 objects.

## Telegram channels

Two groups, one bot (`TELEGRAM_BOT_TOKEN`):

| Group        | Env                    | Content                                                               |
| ------------ | ---------------------- | --------------------------------------------------------------------- |
| Рабочая      | `TELEGRAM_CHAT_ID`     | Live order cards (`editMessageText`), SLA / problematic flags on card |
| Dev / Alerts | `TELEGRAM_DEV_CHAT_ID` | CI fail, PR opened/merged — **не** карточки заказов                   |

Setup dev group: create group → add bot → post a message → `getUpdates` → copy negative `chat.id` (e.g. `-100…`). Do **not** put order cards in the dev group.

**GitHub Actions** (repo → Settings → Secrets): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_DEV_CHAT_ID`.

| Workflow               | Событие            | TG-сообщение                                       |
| ---------------------- | ------------------ | -------------------------------------------------- |
| `ci.yml`               | CI fail            | шаг, ошибка, рекомендация RU, фрагмент лога        |
| `dev-tg-pr-notify.yml` | PR opened/reopened | новый PR + ссылка                                  |
| `dev-tg-pr-notify.yml` | PR merged          | merged + smoke hint если migrations/env/auth/money |

App helper: `sendDevTelegramAlert()` in `src/lib/notifications/dev-telegram.ts`.

## Cron

- Path: `GET|POST /api/cron/sla-overdue`
- Auth: `Authorization: Bearer ${CRON_SECRET}` (timing-safe compare; `src/lib/cron/auth.ts`)
- Schedule (Vercel **Hobby**): **once/day** — `vercel.json` → `0 6 * * *` (06:00 UTC). Hobby max 1 cron/day; `*/15` breaks deploy.
- Optional **Pro** or external: hit route every 15 min with Bearer secret (e.g. [cron-job.org](https://cron-job.org)); idempotent.
- Logs: tag `[sla]` (no secrets)
- Dedup: `orders.sla_overdue_notified_at` — not more than once per 24h
- Threshold: active `sla_goals` `is_system_default=true` (fallback 72h)
- Without secret → **401**

Smoke: no header → 401; valid Bearer → 200.

## Secret rotation

Update **all** ends of a pair in one window (Vercel + Neon + R2 + Telegram), then smoke: login, cron 401/200, create order → TG card if configured.

## Pre-push / CI

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
```

Same in `.github/workflows/ci.yml` (169 unit tests as of Phase 10).

## Smoke by role (§20.11 / §22)

**Setup:** `npm run seed:admin` then `CONFIRM_SEED_DEMO=yes npm run seed:demo`.

Default demo password: `Demo123!` (override `SEED_DEMO_PASSWORD` in env only — do not document real prod passwords here).

| Role               | Login (demo)               | Nav / access                                                                             | Minimal smoke                                                                                        |
| ------------------ | -------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **admin**          | `SEED_ADMIN_EMAIL`         | All sections incl. `/admin/*`, `/reports`                                                | Create user; SLA goal; catalog import test xlsx; audit on order; admin status jump                   |
| **photo_center A** | `point-a@dkprint.local`    | Orders (own client), catalog read, **no** workshop/tasks/reports/admin                   | Sees only client A orders; create order catalog + manual line; **403** on `/api/tasks`, files upload |
| **photo_center B** | `point-b@dkprint.local`    | Same as A for client B                                                                   | Does **not** see A orders (`GET /api/orders`)                                                        |
| **production**     | `production@dkprint.local` | Orders, workshop, clients, tasks, audit; reports **only with** `can_access_reports` flag | Status next on workshop; TTN toggle; edit own-source order fields                                    |
| **designer**       | `designer@dkprint.local`   | Workshop, tasks; **no** cancel/soft-delete; **no** audit                                 | Status next; **no** cancel button; comment + problematic layout                                      |
| **courier**        | `courier@dkprint.local`    | Orders (delivery statuses only)                                                          | **403** tasks/files; delivery status transitions only                                                |

**Cross-cutting smoke (any privileged role):**

- [ ] `GET /api/reports/summary` — 200 with flag / admin; 403 without
- [ ] `GET /api/reports/export?format=csv` — download matches dashboard period
- [ ] Presign upload → confirm → download (client block)
- [ ] Cancel + soft-delete excluded from `/reports` KPI counts
- [ ] Cron: `curl` without auth → 401; with `Authorization: Bearer $CRON_SECRET` → 200

**After deploy / migration change:** re-run login + one action per role above; spot-check Neon `\d order_items` if catalog orders fail.
