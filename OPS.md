# OPS — DKPrint CRM

Operational notes for staging/prod. **No secret values** in this file — only names and procedures.

Canonical product/tech spec: `docs/DKPrint-CRM-TZ-v1.md` (v1.6).

## Source of truth map

| Data                               | Owner (SoT)                                     | Notes                                                                                               |
| ---------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Users / roles / permission flags   | CRM DB (`users`, `permission_overrides`)        | Admin creates users; no public signup                                                               |
| Clients (photo centers)            | CRM DB (`clients`)                              |                                                                                                     |
| Orders + status                    | CRM DB (`orders`) + `status_transitions`        | Status only via transitions (+ admin jump)                                                          |
| Prices / line totals / order total | CRM + `lib/money`                               | Operator enters `unitPrice`; server `formatMoney2` / `lineTotal` / recalc. No site calculator in v1 |
| Order item `name`, qty, tech       | CRM (`order_items`)                             |                                                                                                     |
| Files / R2 keys                    | CRM (`files`) + R2                              | Key: `dkprint/{R2_ENV}/orders/{orderNumber}/items/...`                                              |
| Audit / status events              | CRM (`order_audit_logs`, `order_status_events`) | Audit UI/API: admin \| production only                                                              |
| Telegram live card                 | CRM `orders.telegram_message_id` + Bot API      | Outbound only; chat = `TELEGRAM_CHAT_ID`                                                            |
| Web Push subscriptions             | CRM + VAPID                                     | Event-driven; not TG                                                                                |
| Categories / SLA defaults          | CRM admin                                       | Prefer deactivate over hard-delete                                                                  |
| Product catalog / list prices      | CRM `catalog_*` (§13.1)                         | Admin import/export; order lines snapshot price; not browser SoT                                    |
| Consumables BOM                    | `catalog_product_consumables`                   | Schema in v1; warehouse write-off = roadmap                                                         |

Do **not** treat client-submitted floats as money truth without going through `lib/money`.

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
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`  | Outbound group card                                                        |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | First admin only                                                           |
| `SEED_DEMO_PASSWORD`                       | Optional demo roster                                                       |

See `.env.example`.

## Migrations (apply in order on Neon)

1. `migrations/001_init.sql` (greenfield includes catalog tables from 9b.1)
2. `migrations/seed.sql` (categories, SLA, transitions)
3. `migrations/002_orders_telegram_message_id.sql`
4. `migrations/003_orders_is_urgent.sql`
5. `migrations/004_order_items_name.sql`
6. `migrations/005_catalog.sql` — catalog_* + order_items links (skip if DB created from current `001`)
7. `npm run seed:admin`

Optional: `CONFIRM_SEED_DEMO=yes npm run seed:demo`.

## Cron

- Path: `GET|POST /api/cron/sla-overdue`
- Auth: `Authorization: Bearer ${CRON_SECRET}` (timing-safe compare)
- Schedule: every ~15 min (Vercel Cron)
- Without secret → 401

Smoke: call without header → 401; with secret → 200.

## Secret rotation

Update **all** ends of a pair in one window (Vercel + Neon + R2 + Telegram), then smoke: login, cron 401/200, create order → TG card if configured.

## Pre-push / CI

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
```

Same steps in `.github/workflows/ci.yml`.

## Smoke by role (after seed:demo)

| Role         | Email (demo)               | Expect                                   |
| ------------ | -------------------------- | ---------------------------------------- |
| admin        | `SEED_ADMIN_EMAIL`         | All nav; audit; users                    |
| photo_center | `point-a@dkprint.local`    | Own client orders; no audit; no workshop |
| production   | `production@dkprint.local` | Orders + workshop + audit                |
| designer     | `designer@dkprint.local`   | Workshop; no audit write path            |
| courier      | `courier@dkprint.local`    | Delivery statuses; urgent read-only      |

Default demo password: `Demo123!` (override `SEED_DEMO_PASSWORD`).
